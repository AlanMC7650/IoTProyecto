import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Dispositivo } from "./Dispositivo";

export type TipoEvento = "FUGA" | "LIMITE" | "FLUJO_CONTINUO" | "VALVULA";

// Los de FUGA, LIMITE y FLUJO_CONTINUO los registra la BD al recibir lecturas;
// los de VALVULA, el Back cuando el usuario cambia el modo de la válvula.
@Entity("evento")
export class Evento {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id_evento!: string;

  @ManyToOne(() => Dispositivo)
  @JoinColumn({ name: "id_dispositivo" })
  dispositivo!: Dispositivo;

  @Column({ type: "varchar", length: 20 })
  tipo!: TipoEvento;

  @Column({ type: "varchar", length: 255, nullable: true })
  detalle!: string | null;

  @Column({ type: "timestamptz", default: () => "NOW()" })
  fecha!: Date;

  @Column({ default: false })
  atendido!: boolean;
}
