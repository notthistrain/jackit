/**
 * WebGPU WGSL shader for waveform line rendering
 *
 * Multi-channel line-strip with per-channel colors.
 * Grid overlay is rendered via HTML (WaveformOverlay.tsx).
 */

import { generateColorArrayWGSL, MAX_CHANNELS } from './channel-colors'

export const WAVEFORM_SHADER = /* wgsl */`

struct Uniforms {
  resolution: vec2f,
  num_channels: f32,
  offset_x: f32,
  zoom: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

${generateColorArrayWGSL()}

// === 波形折线 ===

struct LineVertexInput {
  @location(0) point_index: f32,
  @location(1) value: f32,
  @location(2) channel_id: f32,
};

struct LineVertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn line_vertex(input: LineVertexInput) -> LineVertexOutput {
  var output: LineVertexOutput;

  let max_points = uniforms.resolution.x / uniforms.zoom;
  let x_norm = (input.point_index / max_points) + uniforms.offset_x;
  let y_norm = 1.0 - (input.value * 0.8 + 0.1);

  // 多通道垂直偏移
  let channel_offset = select(0.0,
    f32(input.channel_id) / uniforms.num_channels,
    uniforms.num_channels > 1.0
  );

  let x_clip = (x_norm * 2.0 - 1.0);
  let y_clip = ((y_norm * (1.0 - channel_offset)) * 2.0 - 1.0);

  output.position = vec4f(x_clip, y_clip, 0.0, 1.0);

  let ch_idx = i32(input.channel_id) % ${MAX_CHANNELS};
  let color_rgb = CHANNEL_COLORS[ch_idx];
  output.color = vec4f(color_rgb, 1.0);

  return output;
}

@fragment
fn line_fragment(input: LineVertexOutput) -> @location(0) vec4f {
  return input.color;
}

`
