import { Controller, Get } from '@midwayjs/core'
import { ResDTO } from '../dto/tools.dto'

@Controller('/health')
export class HealthyController {
  @Get('/')
  async health() {
    return ResDTO.ok()
  }
}
