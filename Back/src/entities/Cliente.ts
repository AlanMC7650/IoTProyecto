import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Dispositivo } from "./Dispositivo";

export type Rol = "usuario" | "admin";

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

  @Column({ type: "varchar", length: 10, default: "usuario" })
  rol!: Rol;

  @Column({ default: true })
  activo!: boolean;

  @Column({ type: "timestamp", default: () => "NOW()" })
  fecha_registro!: Date;

  @OneToMany(() => Dispositivo, (d) => d.cliente)
  dispositivos!: Dispositivo[];
}
