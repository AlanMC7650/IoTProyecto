import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Cliente } from "./Cliente";

@Entity("serie_taylor")
export class SerieTaylor {
  @PrimaryGeneratedColumn()
  id_taylor!: number;

  @ManyToOne(() => Cliente, (c) => c.taylor)
  @JoinColumn({ name: "id_cliente" })
  cliente!: Cliente;

  @Column({ type: "uuid" })
  id_ejecucion!: string;

  @Column({ length: 20 })
  funcion!: string;

  @Column({ type: "decimal", precision: 10, scale: 6 })
  x_valor!: string;

  @Column()
  iteracion!: number;

  @Column({ type: "decimal", precision: 20, scale: 15 })
  valor_calculado!: string;

  @Column({ type: "decimal", precision: 20, scale: 15 })
  valor_real!: string;

  @Column({ type: "decimal", precision: 20, scale: 15 })
  error!: string;

  @Column({ type: "timestamp", default: () => "NOW()" })
  fecha_generacion!: Date;
}