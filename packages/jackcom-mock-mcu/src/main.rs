mod protocols;
mod scenarios;

use std::io::Write;
use std::time::Duration;

use clap::Parser;
use serialport::SerialPort;

#[derive(Parser, Debug)]
#[command(name = "jackcom-mock-mcu")]
#[command(about = "Mock MCU serial port simulator for JackCom testing")]
struct Args {
    /// Serial port name (e.g. COM20, /dev/pts/3)
    #[arg(short, long)]
    port: Option<String>,

    /// Scenario to run
    #[arg(short, long, default_value = "mixed")]
    scenario: scenarios::Scenario,

    /// Send interval in milliseconds
    #[arg(short, long)]
    interval: Option<u64>,

    /// List available serial ports
    #[arg(long)]
    list_ports: bool,
}

fn main() {
    let args = Args::parse();

    if args.list_ports {
        list_available_ports();
        return;
    }

    let port_name = match args.port {
        Some(p) => p,
        None => {
            eprintln!("Error: --port is required (use --list-ports to see available ports)");
            std::process::exit(1);
        }
    };

    let interval = args.interval.unwrap_or_else(|| args.scenario.default_interval());

    println!("jackcom-mock-mcu");
    println!("  Port: {}", port_name);
    println!("  Scenario: {:?}", args.scenario);
    println!("  Interval: {}ms", interval);
    println!();

    // 打开串口
    let mut port = match serialport::new(&port_name, 115200)
        .timeout(Duration::from_millis(100))
        .open()
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Failed to open port '{}': {}", port_name, e);
            std::process::exit(1);
        }
    };

    println!("Port opened. Press Ctrl+C to stop.\n");

    // AT 场景走响应式模式
    if matches!(args.scenario, scenarios::Scenario::AtEsp32) {
        if let Err(e) = scenarios::run_at_scenario(&mut port) {
            eprintln!("AT scenario error: {}", e);
        }
        return;
    }

    // 主动发送模式
    let mut counter: u32 = 0;
    loop {
        let frame = scenarios::generate_frame(&args.scenario, counter);
        match port.write_all(&frame) {
            Ok(()) => {
                if let Err(e) = port.flush() {
                    eprintln!("Flush error: {}", e);
                }
                let hex_preview: String = frame.iter()
                    .take(16)
                    .map(|b| format!("{:02X}", b))
                    .collect::<Vec<_>>()
                    .join(" ");
                let suffix = if frame.len() > 16 { " ..." } else { "" };
                println!("[{}] {} bytes: {}{}", counter, frame.len(), hex_preview, suffix);
            }
            Err(e) => {
                eprintln!("Write error: {}", e);
                std::thread::sleep(Duration::from_millis(1000));
            }
        }

        counter = counter.wrapping_add(1);

        if interval > 0 {
            std::thread::sleep(Duration::from_millis(interval));
        }
    }
}

fn list_available_ports() {
    match serialport::available_ports() {
        Ok(ports) => {
            if ports.is_empty() {
                println!("No serial ports found.");
            } else {
                println!("Available serial ports:");
                for p in &ports {
                    println!("  {} {}", p.port_name, match &p.port_type {
                        serialport::SerialPortType::UsbPort(info) => {
                            let mut s = "(USB)".to_string();
                            if let Some(manufacturer) = &info.manufacturer {
                                s.push_str(&format!(" [{}]", manufacturer));
                            }
                            s
                        }
                        serialport::SerialPortType::BluetoothPort => "(Bluetooth)".to_string(),
                        serialport::SerialPortType::PciPort => "(PCI)".to_string(),
                        _ => String::new(),
                    });
                }
            }
        }
        Err(e) => {
            eprintln!("Error listing ports: {}", e);
        }
    }
}
