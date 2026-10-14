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

export type EstadoDispositivo = "pendiente" | "vinculado";
export type ModoValvula = "auto" | "abierta" | "cerrada";

// El dispositivo lo crea la función anunciar_dispositivo de la BD cuando el
// ESP32 se anuncia por primera vez; al vincularlo pasa a tener dueño y nombre.
@Entity("dispositivo")
export class Dispositivo {
  @PrimaryGeneratedColumn()
  id_dispositivo!: number;

  @ManyToOne(() => Cliente, (c) => c.dispositivos, { nullable: true })
  @JoinColumn({ name: "id_cliente" })
  cliente!: Cliente | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  nombre!: string | null;

  @Column({ type: "char", length: 17, nullable: true, select: false })
  mac!: string | null;

  @Column({ type: "char", length: 6, nullable: true, select: false })
  codigo_vinculo!: string | null;

  @Column({ type: "varchar", length: 10, default: "pendiente" })
  estado!: EstadoDispositivo;

  @Column({ type: "char", length: 64, nullable: true, select: false })
  token_hash!: string | null;

  @Column({ type: "decimal", precision: 8, scale: 3, default: 450 })
  pulsos_por_litro!: string;

  @Column({ type: "decimal", precision: 10, scale: 3, nullable: true })
  limite_diario_l!: string | null;

  @Column({ type: "varchar", length: 10, default: "auto" })
  valvula_modo!: ModoValvula;

  @Column({ type: "timestamptz", nullable: true, select: false })
  ultimo_anuncio!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  ultima_conexion!: Date | null;

  @Column({ type: "timestamptz", default: () => "NOW()" })
  fecha_registro!: Date;

  @OneToMany(() => LecturaCaudal, (l) => l.dispositivo)
  lecturas!: LecturaCaudal[];
}
