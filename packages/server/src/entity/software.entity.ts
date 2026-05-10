import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { SoftwareVersion } from './software-version.entity'

@Entity()
export class Software {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  name: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true, type: 'text' })
  manual: string

  @Column({ nullable: true })
  ext: string

  @Column({ nullable: true })
  displayName: string

  @Column({ nullable: true })
  identifier: string

  @OneToMany(() => SoftwareVersion, version => version.software)
  versions: SoftwareVersion[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
