use crate::projects;
use anyhow::{Context, Result};
use bytes::BytesMut;
use futures::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::env;
use std::io::{Read, Write};
use tokio::net;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};

const TERM: &str = "xterm-256color";

pub async fn accept_connection(
    projects_store: projects::Storage,
    stream: net::TcpStream,
) -> Result<()> {
    let mut project = None;
    let copy_uri_callback =
        |req: &Request, response: Response| -> Result<Response, ErrorResponse> {
            let path = req.uri().path().to_string();
            let project_id = match path.split("/").last() {
                Some(project_id) => project_id,
                None => {
                    return Err(http::response::Response::builder()
                        .status(http::StatusCode::NOT_FOUND)
                        .body(None)
                        .unwrap());
                }
            };

            project = match projects_store.get_project(project_id) {
                Ok(Some(p)) => Some(p),
                Ok(None) => {
                    return Err(http::response::Response::builder()
                        .status(http::StatusCode::NOT_FOUND)
                        .body(None)
                        .unwrap());
                }
                Err(e) => {
                    log::error!("failed to get project: {}", e);
                    return Err(http::response::Response::builder()
                        .status(http::StatusCode::INTERNAL_SERVER_ERROR)
                        .body(None)
                        .unwrap());
                }
            };

            Ok(response)
        };

    let mut ws_stream = tokio_tungstenite::accept_hdr_async(stream, copy_uri_callback)
        .await
        .with_context(|| format!("failed to accept connection"))?;

    if project.is_none() {
        ws_stream
            .close(None)
            .await
            .with_context(|| format!("failed to close connection"))?;
        return Ok(());
    }
    let project = project.unwrap();

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    let pty_system = native_pty_system();

    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            // Not all systems support pixel_width, pixel_height,
            // but it is good practice to set it to something
            // that matches the size of the selected font.  That
            // is more complex than can be shown here in this
            // brief example though!
            pixel_width: 0,
            pixel_height: 0,
        })
        .with_context(|| format!("failed to open pty"))?;

    let mut cmd = if cfg!(target_os = "windows") {
        // CommandBuilder::new(r"powershell")
        // CommandBuilder::new(r"C:\Program Files\Git\bin\bash.exe")
        // CommandBuilder::new(r"ubuntu.exe") // if WSL is active
        // on UI the user should have the option to choose

        let mut cmd = CommandBuilder::new(r"cmd");

        // this is needed only for cmd.exe
        // because the prompt does not have an empty space at the end
        // the prompt should be sepratared from the command being typed, for command parsing
        cmd.env("PROMPT", "$P$G ");

        cmd
    } else {
        let user_default_shell = env::var("SHELL")?;
        let mut cmd = CommandBuilder::new(user_default_shell);
        cmd.env("TERM", TERM);
        cmd.args(["-i"]);
        cmd
    };

    // set to project path
    cmd.cwd(project.path);

    let mut pty_child_process = pty_pair.slave.spawn_command(cmd)?;

    let mut pty_reader = pty_pair.master.try_clone_reader()?;
    let mut pty_writer = pty_pair.master.take_writer()?;

    // it's important to spawn a new thread for the pty reader
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let mut buffer = BytesMut::with_capacity(1024);
            buffer.resize(1024, 0u8);
            loop {
                buffer[0] = 0u8;
                let mut tail = &mut buffer[1..];

                match pty_reader.read(&mut tail) {
                    Ok(0) => {
                        // EOF
                        log::info!("0 bytes read from pty. EOF.");
                        break;
                    }
                    Ok(n) => {
                        let mut data_to_send = Vec::with_capacity(n + 1);
                        data_to_send.extend_from_slice(&buffer[..n + 1]);
                        record_data(&data_to_send);
                        let message = tokio_tungstenite::tungstenite::Message::Binary(data_to_send);
                        ws_sender.send(message).await.unwrap();
                    }
                    Err(e) => {
                        log::error!("Error reading from pty: {:#}", e);
                        break;
                    }
                }
            }

            log::info!("PTY child process killed.");
        });
    });

    while let Some(message) = ws_receiver.next().await {
        match message {
            Ok(tokio_tungstenite::tungstenite::Message::Binary(msg)) => {
                let msg_bytes = msg.as_slice();
                match msg_bytes[0] {
                    0 => {
                        if msg_bytes.len().gt(&0) {
                            record_data(&msg);
                            pty_writer.write_all(&msg_bytes[1..]).unwrap();
                        }
                    }
                    1 => {
                        let pty_size: PtySize = serde_json::from_slice(&msg_bytes[1..]).unwrap();
                        pty_pair.master.resize(pty_size).unwrap();
                    }
                    _ => log::error!("Unknown command {}", msg_bytes[0]),
                }
            }
            Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                log::info!("Closing the websocket connection...");

                log::info!("Killing PTY child process...");
                pty_child_process
                    .kill()
                    .with_context(|| format!("failed to kill pty child process"))?;
                break;
            }
            Ok(_) => log::error!("Unknown received data type"),
            Err(e) => {
                log::error!("Error receiving data: {}", e);
                break;
            }
        }
    }
    Ok(())
}

// this sort of works, but it's not how we want to do it
// it just appends the data from every pty to the same file
// what we want to do is set the directory to record to, but since
// the reader is in a spawe thread, it's difficult to pass the directory to it
// I also can't seem to send data to the pty on opening a new one, so I can't
// easily initialize the cwd, which is where we want to write this data (under .git)
// HELP
fn record_data(_data: &Vec<u8>) {
    /*
    // A little too aggressive:
    let mut file = OpenOptions::new()
        .write(true)
        .append(true)
        .create(true)
        .open("data.txt")
        .unwrap();
    file.write_all(data).unwrap();
    */
}
