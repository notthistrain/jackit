import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Software } from './software.entity'

@Entity()
export class SoftwareVersion {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  sequence: string

  @Column({ nullable: true })
  key: string

  @Column({ nullable: true })
  size: number

  @Column({ default: false })
  force: boolean

  @Column({ nullable: true, type: 'text' })
  changelog: string

  @ManyToOne(() => Software, software => software.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'softwareId' })
  software: Software

  @Column()
  softwareId: number

  @CreateDateColumn()
  createdAt: Date
}
