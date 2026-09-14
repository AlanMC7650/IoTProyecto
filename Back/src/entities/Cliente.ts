import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { SerieLeibniz } from "./SerieLeibniz";
import { SerieFibonacci } from "./SerieFibonacci";
import { SerieTaylor } from "./SerieTaylor";

@Entity("cliente")
export class Cliente {
  @PrimaryGeneratedColumn()
  id_cliente!: number;

  @Column({ length: 150 })
  nombre!: string;

  @Column({ length: 50, unique: true })
  identificador!: string;

  @Column({ length: 150, unique: true })
  email!: string;

  @Column({ length: 255, select: false })
  password_hash!: string;

  @Column({ type: "timestamp", default: () => "NOW()" })
  fecha_registro!: Date;

  @OneToMany(() => SerieLeibniz, (s) => s.cliente)
  leibniz!: SerieLeibniz[];

  @OneToMany(() => SerieFibonacci, (s) => s.cliente)
  fibonacci!: SerieFibonacci[];

  @OneToMany(() => SerieTaylor, (s) => s.cliente)
  taylor!: SerieTaylor[];
}