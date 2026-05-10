import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity()
export class SystemSetting {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  key: string

  @Column({ type: 'text' })
  value: string

  @Column({ nullable: true })
  description: string

  @UpdateDateColumn()
  updatedAt: Date
}
