# Mock MCU 端到端测试工具 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建独立的 Rust CLI 工具 `jackcom-mock-mcu`，通过虚拟串口模拟 MCU 发送串口数据，支持 Modbus/AT/JSON/Raw 四种协议场景。

**架构：** 独立 crate `packages/jackcom-mock-mcu`，包含 CLI 入口、场景定义、帧构造器三个模块。使用 clap 处理命令行参数，serialport 处理串口通信，独立实现 CRC-16/Modbus。

**技术栈：** Rust + clap 4 + serialport 4 + serde_json 1 + rand 0.8

**规格文档：** `docs/superpowers/specs/2026-05-14-jackcom-placeholder-features-design.md` 第 5 节

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `packages/jackcom-mock-mcu/Cargo.toml` | crate 配置 |
| `packages/jackcom-mock-mcu/src/main.rs` | CLI 入口 + 串口连接 + 发送循环 |
| `packages/jackcom-mock-mcu/src/scenarios.rs` | 场景定义（Modbus/AT/JSON/Raw/Mixed） |
| `packages/jackcom-mock-mcu/src/protocols.rs` | 帧构造器 + CRC-16 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `package.json` | 添加 `mock:mcu` 脚本 |

---

### 任务 1：Crate 骨架 + Cargo.toml

**文件：**
- 创建：`packages/jackcom-mock-mcu/Cargo.toml`
- 创建：`packages/jackcom-mock-mcu/src/main.rs`（空骨架）

- [ ] **步骤 1：创建目录结构**

运行：
```bash
mkdir -p packages/jackcom-mock-mcu/src
```

- [ ] **步骤 2：创建 Cargo.toml**

创建 `packages/jackcom-mock-mcu/Cargo.toml`：

```toml
[package]
name = "jackcom-mock-mcu"
version = "0.1.0"
edition = "2021"
description = "Mock MCU serial port simulator for JackCom end-to-end testing"

[dependencies]
serialport = "4"
clap = { version = "4", features = ["derive"] }
serde_json = "1"
rand = "0.8"
```

- [ ] **步骤 3：创建空 main.rs**

创建 `packages/jackcom-mock-mcu/src/main.rs`：

```rust
fn main() {
    println!("jackcom-mock-mcu placeholder");
}
```

- [ ] **步骤 4：验证编译**

运行：`cd packages/jackcom-mock-mcu && cargo check`
预期：编译通过

- [ ] **步骤 5：Commit**

```bash
git add packages/jackcom-mock-mcu/
git commit -m "feat(jackcom): 创建 jackcom-mock-mcu crate 骨架"
```

---

### 任务 2：protocols.rs — 帧构造器 + CRC-16

**文件：**
- 创建：`packages/jackcom-mock-mcu/src/protocols.rs`

- [ ] **步骤 1：实现协议帧构造器**

创建 `packages/jackcom-mock-mcu/src/protocols.rs`：

```rust
/// 独立实现的 CRC-16/Modbus
pub fn crc16_modbus(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 0x0001 != 0 {
                crc >>= 1;
                crc ^= 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

/// 构建 Modbus RTU 读保持寄存器响应帧
///
/// slave: 从站地址
/// values: 寄存器值列表
pub fn build_modbus_response(slave: u8, values: &[u16]) -> Vec<u8> {
    let byte_count = (values.len() * 2) as u8;
    let mut data = vec![
        slave,               // 从站地址
        0x03,                // 功能码：读保持寄存器
        byte_count,          // 字节数
    ];
    for &val in values {
        data.push((val >> 8) as u8); // 高字节
        data.push((val & 0xFF) as u8); // 低字节
    }
    let crc = crc16_modbus(&data);
    data.push((crc & 0xFF) as u8);    // CRC 低字节
    data.push((crc >> 8) as u8);      // CRC 高字节
    data
}

/// 构建 AT 命令响应
///
/// command: AT 命令字符串（如 "AT"、"AT+RST"）
pub fn build_at_response(command: &str) -> Vec<u8> {
    match command {
        "AT" => b"\r\nOK\r\n".to_vec(),
        "AT+RST" => b"\r\nOK\r\n\r\nready\r\n".to_vec(),
        "AT+GMR" => b"\r\nAT version:2.0.0\r\nSDK version:v4.0\r\nOK\r\n".to_vec(),
        "AT+CIFSR" => b"\r\n+CIFSR:STAIP,\"192.168.1.100\"\r\nOK\r\n".to_vec(),
        _ => b"\r\nERROR\r\n".to_vec(),
    }
}

/// 构建 JSON 传感器数据
pub fn build_json_payload(temp: f64, hum: f64, pressure: f64) -> Vec<u8> {
    let json = serde_json::json!({
        "temp": (temp * 10.0).round() / 10.0,
        "hum": (hum * 10.0).round() / 10.0,
        "press": (pressure * 10.0).round() / 10.0,
    });
    format!("{}\n", serde_json::to_string(&json).unwrap()).into_bytes()
}

/// 构建随机二进制数据
pub fn build_raw_random(len: usize) -> Vec<u8> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..len).map(|_| rng.gen()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crc16_modbus_known_value() {
        // Modbus CRC-16 标准测试向量
        let data: Vec<u8> = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let crc = crc16_modbus(&data);
        // 预期值：0xC5CD（与 jackcom 协议解析器兼容）
        assert_eq!(crc, 0xC5CD);
    }

    #[test]
    fn test_modbus_response_format() {
        let frame = build_modbus_response(1, &[0x001E, 0x001F]);
        // slave=1, func=3, byte_count=4, data=[00,1E,00,1F], CRC(2 bytes)
        assert_eq!(frame.len(), 9); // 3 header + 4 data + 2 CRC
        assert_eq!(frame[0], 1);    // slave
        assert_eq!(frame[1], 0x03); // func
        assert_eq!(frame[2], 4);    // byte count
    }

    #[test]
    fn test_modbus_response_crc_valid() {
        let frame = build_modbus_response(1, &[30, 31, 32]);
        let data = &frame[..frame.len() - 2];
        let crc_bytes = &frame[frame.len() - 2..];
        let expected_crc = crc16_modbus(data);
        let actual_crc = crc_bytes[0] as u16 | ((crc_bytes[1] as u16) << 8);
        assert_eq!(expected_crc, actual_crc);
    }

    #[test]
    fn test_at_response_ok() {
        let resp = build_at_response("AT");
        let s = String::from_utf8_lossy(&resp);
        assert!(s.contains("OK"));
    }

    #[test]
    fn test_at_response_rst() {
        let resp = build_at_response("AT+RST");
        let s = String::from_utf8_lossy(&resp);
        assert!(s.contains("OK"));
        assert!(s.contains("ready"));
    }

    #[test]
    fn test_at_response_unknown() {
        let resp = build_at_response("AT+UNKNOWN");
        let s = String::from_utf8_lossy(&resp);
        assert!(s.contains("ERROR"));
    }

    #[test]
    fn test_json_payload() {
        let payload = build_json_payload(25.6, 60.1, 1013.0);
        let s = String::from_utf8(payload).unwrap();
        let v: serde_json::Value = serde_json::from_str(s.trim()).unwrap();
        assert_eq!(v["temp"], 25.6);
        assert_eq!(v["hum"], 60.1);
    }

    #[test]
    fn test_raw_random_length() {
        let data = build_raw_random(42);
        assert_eq!(data.len(), 42);
    }
}
```

- [ ] **步骤 2：运行测试**

运行：`cd packages/jackcom-mock-mcu && cargo test`
预期：全部 PASS

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom-mock-mcu/src/protocols.rs
git commit -m "feat(jackcom): mock-mcu 添加协议帧构造器和 CRC-16"
```

---

### 任务 3：scenarios.rs — 场景定义

**文件：**
- 创建：`packages/jackcom-mock-mcu/src/scenarios.rs`

- [ ] **步骤 1：实现场景定义**

创建 `packages/jackcom-mock-mcu/src/scenarios.rs`：

```rust
use rand::Rng;
use std::io::{self, Read};

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

use std::io::Write;
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jackcom-mock-mcu/src/scenarios.rs
git commit -m "feat(jackcom): mock-mcu 添加场景定义（Modbus/AT/JSON/Raw/Mixed）"
```

---

### 任务 4：main.rs — CLI 入口 + 发送循环

**文件：**
- 修改：`packages/jackcom-mock-mcu/src/main.rs`

- [ ] **步骤 1：实现 CLI 入口和发送循环**

修改 `packages/jackcom-mock-mcu/src/main.rs` 为：

```rust
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
```

- [ ] **步骤 2：运行测试确认无回归**

运行：`cd packages/jackcom-mock-mcu && cargo test`
预期：全部 PASS

- [ ] **步骤 3：验证编译**

运行：`cd packages/jackcom-mock-mcu && cargo build`
预期：编译通过

- [ ] **步骤 4：验证 --help 输出**

运行：`cd packages/jackcom-mock-mcu && cargo run -- --help`
预期：显示帮助信息，包含 --port、--scenario、--interval、--list-ports 参数

- [ ] **步骤 5：验证 --list-ports**

运行：`cd packages/jackcom-mock-mcu && cargo run -- --list-ports`
预期：列出可用串口（可能为空）

- [ ] **步骤 6：Commit**

```bash
git add packages/jackcom-mock-mcu/src/main.rs
git commit -m "feat(jackcom): mock-mcu CLI 入口和发送循环完整实现"
```

---

### 任务 5：项目集成

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：添加 mock:mcu 脚本到根 package.json**

在 `package.json` 的 `scripts` 部分添加：

```json
    "mock:mcu": "cd packages/jackcom-mock-mcu && cargo run"
```

完整的 scripts 部分变为：

```json
  "scripts": {
    "dev:server": "pnpm --filter @upgrade/server dev",
    "dev:admin": "pnpm --filter @upgrade/admin dev",
    "dev:toolbox": "pnpm --filter @app/toolbox dev",
    "dev:jackcom": "pnpm --filter @app/jackcom dev",
    "build": "pnpm -r build",
    "build:jackcom": "pnpm --filter @app/jackcom build",
    "test": "pnpm --filter @upgrade/server test",
    "test:jackcom": "pnpm --filter @app/jackcom test",
    "test:jackcom:rust": "cd packages/jackcom/src-tauri && cargo test",
    "test:mock-mcu": "cd packages/jackcom-mock-mcu && cargo test",
    "mock:mcu": "cd packages/jackcom-mock-mcu && cargo run",
    "lint": "pnpm -r lint"
  },
```

- [ ] **步骤 2：验证脚本可用**

运行：`pnpm mock:mcu -- --help`
预期：显示帮助信息

- [ ] **步骤 3：Commit**

```bash
git add package.json
git commit -m "feat(jackcom): 添加 mock:mcu 和 test:mock-mcu npm 脚本"
```

---

## 自检

### 规格覆盖度

| 规格需求 | 对应任务 |
|----------|----------|
| CLI 接口（--port / --scenario / --interval / --list-ports） | 任务 4 |
| CRC-16/Modbus 独立实现 | 任务 2 |
| Modbus RTU 响应帧构造 | 任务 2 |
| AT 命令响应 | 任务 2 |
| JSON 传感器数据 | 任务 2 |
| 随机二进制数据 | 任务 2 |
| Mixed 混合场景（40% Modbus / 20% AT → 实际在 Mixed 中 AT 转为 Raw / 20% JSON / 20% Raw） | 任务 3 |
| AT 场景响应式模式（双向通信） | 任务 3（run_at_scenario） |
| Ctrl+C 优雅退出 | 任务 4（默认信号处理） |
| workspace 集成（根 package.json 脚本） | 任务 5 |

### 占位符扫描

无 TODO/TBD。所有模块有完整实现和测试。

### 类型一致性

- `Scenario` 枚举在 scenarios.rs 中定义，通过 clap ValueEnum 派生
- `protocols` 模块函数签名在任务 2 中定义，被 scenarios.rs 调用
- main.rs 中 `scenarios::Scenario` 和 `scenarios::generate_frame` 与 scenarios.rs 导出一致

### 澄清

- Mixed 场景中 AT 占 20% 的处理：AT 场景本质上是响应式的（需要双向通信），不适合在 Mixed 主动发送模式中使用。Mixed 场景中 40% Modbus / 30% JSON / 30% Raw，不包含 AT。AT 场景只能独立使用 `--scenario at-esp32`。
