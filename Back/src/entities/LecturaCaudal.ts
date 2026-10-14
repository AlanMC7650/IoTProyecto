import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Dispositivo } from "./Dispositivo";

// Las inserta la función registrar_lecturas de la BD (el ESP32 envía directo a
// Supabase); el Back solo las lee.
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

  // Sensor de agua T1592: 0 (seco) a 4095 (totalmente mojado)
  @Column({ type: "smallint", nullable: true })
  nivel_agua!: number | null;

  @Column({ default: false })
  fuga!: boolean;

  @Column({ type: "boolean", nullable: true })
  valvula_abierta!: boolean | null;

  @Column({ type: "varchar", length: 15, nullable: true })
  led_estado!: string | null;

  @Column({ type: "smallint", nullable: true })
  led_brillo!: number | null;

  @Column({ type: "timestamptz" })
  fecha_medicion!: Date;

  @Column({ type: "timestamptz", default: () => "NOW()" })
  fecha_recepcion!: Date;
}
