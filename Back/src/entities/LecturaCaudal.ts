import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Dispositivo } from "./Dispositivo";

@Entity("lectura_caudal")
export class LecturaCaudal {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id_lectura!: string;

  @ManyToOne(() => Dispositivo, (d) => d.lecturas)
  @JoinColumn({ name: "id_dispositivo" })
  dispositivo!: Dispositivo;

  @Column({ type: "decimal", precision: 10, scale: 3 })
  caudal_lmin!: string;

  @Column({ type: "decimal", precision: 14, scale: 3 })
  volumen_l!: string;

  @Column()
  pulsos!: number;

  @Column({ type: "timestamptz" })
  fecha_medicion!: Date;

  @Column({ type: "timestamptz", default: () => "NOW()" })
  fecha_recepcion!: Date;
}
