import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Cliente } from "./Cliente";
import { LecturaCaudal } from "./LecturaCaudal";

@Entity("dispositivo")
export class Dispositivo {
  @PrimaryGeneratedColumn()
  id_dispositivo!: number;

  @ManyToOne(() => Cliente, (c) => c.dispositivos)
  @JoinColumn({ name: "id_cliente" })
  cliente!: Cliente;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ type: "char", length: 64, unique: true, select: false })
  api_key_hash!: string;

  @Column({ type: "decimal", precision: 8, scale: 3, default: 450 })
  pulsos_por_litro!: string;

  @Column({ type: "timestamptz", nullable: true })
  ultima_conexion!: Date | null;

  @Column({ type: "timestamptz", default: () => "NOW()" })
  fecha_registro!: Date;

  @OneToMany(() => LecturaCaudal, (l) => l.dispositivo)
  lecturas!: LecturaCaudal[];
}
