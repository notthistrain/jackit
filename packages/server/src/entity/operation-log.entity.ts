import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  action: string

  @Column()
  target: string

  @Column({ type: 'text' })
  detail: string

  @Column({ nullable: true })
  operator: string

  @CreateDateColumn()
  createdAt: Date
}
