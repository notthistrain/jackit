/**
 * WebGPU WGSL shaders for waveform rendering
 *
 * 网格背景 + 多通道折线图
 */

// === Uniform 结构 ===

export const WAVEFORM_SHADER = /* wgsl */`

struct Uniforms {
  resolution: vec2f,     // canvas 尺寸
  time_window: f32,      // 时间窗口（秒）
  num_channels: f32,     // 通道数量
  offset_x: f32,         // 平移偏移
  zoom: f32,             // 缩放级别
  pad1: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// === 网格背景 ===

struct GridVertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn grid_vertex(@location(0) pos: vec2f) -> GridVertexOutput {
  var output: GridVertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.color = vec4f(0.15, 0.15, 0.15, 1.0);
  return output;
}

@fragment
fn grid_fragment(input: GridVertexOutput) -> @location(0) vec4f {
  return input.color;
}

// === 波形折线 ===

struct LineVertexInput {
  @location(0) point_index: f32,  // 数据点索引
  @location(1) value: f32,        // 数据值
  @location(2) channel_id: f32,   // 通道 ID
};

struct LineVertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

const CHANNEL_COLORS = array<vec3f, 8>(
  vec3f(0.306, 0.788, 0.690),  // --color-rx #4EC9B0
  vec3f(0.337, 0.612, 0.839),  // --color-tx #569CD6
  vec3f(0.808, 0.569, 0.471),  // #CE9178
  vec3f(0.863, 0.863, 0.667),  // #DCDCAA
  vec3f(0.773, 0.529, 0.757),  // #C586C0
  vec3f(0.416, 0.600, 0.333),  // #6A9955
  vec3f(0.000, 0.479, 0.800),  // --color-accent #007ACC
  vec3f(0.957, 0.647, 0.251),  // #F4A540
);

@vertex
fn line_vertex(input: LineVertexInput) -> LineVertexOutput {
  var output: LineVertexOutput;

  // 归一化坐标：x = point_index / max_points, y = value 归一化到 [0, 1]
  let max_points = uniforms.resolution.x / uniforms.zoom;
  let x_norm = (input.point_index / max_points) + uniforms.offset_x;
  let y_norm = 1.0 - (input.value * 0.8 + 0.1); // 留上下边距

  // 通道垂直偏移
  let channel_offset = select(0.0,
    f32(input.channel_id) / uniforms.num_channels,
    uniforms.num_channels > 1.0
  );

  let x_clip = (x_norm * 2.0 - 1.0);
  let y_clip = ((y_norm * (1.0 - channel_offset)) * 2.0 - 1.0);

  output.position = vec4f(x_clip, y_clip, 0.0, 1.0);

  let ch_idx = i32(input.channel_id) % 8;
  let color_rgb = CHANNEL_COLORS[ch_idx];
  output.color = vec4f(color_rgb, 1.0);

  return output;
}

@fragment
fn line_fragment(input: LineVertexOutput) -> @location(0) vec4f {
  return input.color;
}

`;
