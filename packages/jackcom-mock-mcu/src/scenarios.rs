use rand::Rng;
use std::io::{self, Read, Write};

use crate::protocols;

/// 场景类型
#[derive(Debug, Clone, Copy, clap::ValueEnum)]
pub enum Scenario {
    Modbus,
    AtEsp32,
    JsonSensor,
    Raw,
    Mixed,
}

impl Scenario {
    /// 获取场景的默认发送间隔（毫秒）
    pub fn default_interval(&self) -> u64 {
        match self {
            Scenario::Modbus => 100,
            Scenario::AtEsp32 => 0, // 响应式，无主动间隔
            Scenario::JsonSensor => 500,
            Scenario::Raw => 200,
            Scenario::Mixed => 100,
        }
    }
}

/// 生成一帧数据
pub fn generate_frame(scenario: &Scenario, counter: u32) -> Vec<u8> {
    match scenario {
        Scenario::Modbus => generate_modbus_frame(counter),
        Scenario::JsonSensor => generate_json_frame(counter),
        Scenario::Raw => generate_raw_frame(),
        Scenario::AtEsp32 => Vec::new(), // AT 场景不走主动发送
        Scenario::Mixed => generate_mixed_frame(counter),
    }
}

fn generate_modbus_frame(counter: u32) -> Vec<u8> {
    // 模拟 10 个寄存器，数值递增
    let values: Vec<u16> = (0..10)
        .map(|i| (counter * 10 + i) as u16 % 65535)
        .collect();
    protocols::build_modbus_response(1, &values)
}

fn generate_json_frame(counter: u32) -> Vec<u8> {
    let temp = 20.0 + (counter as f64 % 15.0);
    let hum = 40.0 + (counter as f64 % 40.0);
    let press = 1000.0 + (counter as f64 % 30.0);
    protocols::build_json_payload(temp, hum, press)
}

fn generate_raw_frame() -> Vec<u8> {
    let mut rng = rand::thread_rng();
    let len = rng.gen_range(4..32);
    protocols::build_raw_random(len)
}

fn generate_mixed_frame(counter: u32) -> Vec<u8> {
    let mut rng = rand::thread_rng();
    let roll: f64 = rng.gen();
    if roll < 0.4 {
        generate_modbus_frame(counter)
    } else if roll < 0.6 {
        generate_json_frame(counter)
    } else {
        generate_raw_frame()
    }
}

/// AT 响应式场景：从串口读取命令并回复
pub fn run_at_scenario(port: &mut Box<dyn serialport::SerialPort>) -> io::Result<()> {
    println!("AT scenario: waiting for AT commands (response mode)...");
    let mut buffer = [0u8; 256];

    loop {
        match port.read(&mut buffer) {
            Ok(n) if n > 0 => {
                let input = String::from_utf8_lossy(&buffer[..n]);
                let command = input.trim();
                println!("Received: {:?}", command);

                if command.is_empty() { continue; }

                let response = protocols::build_at_response(command);
                port.write_all(&response)?;
                port.flush()?;
                println!("Sent response ({} bytes)", response.len());
            }
            Ok(_) => {}
            Err(ref e) if e.kind() == io::ErrorKind::TimedOut => {
                // 超时正常，继续等待
            }
            Err(e) => return Err(e),
        }
    }
}
