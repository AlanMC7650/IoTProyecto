import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Cliente } from "./Cliente";

@Entity("serie_leibniz")
export class SerieLeibniz {
  @PrimaryGeneratedColumn()
  id_leibniz!: number;

  @ManyToOne(() => Cliente, (c) => c.leibniz)
  @JoinColumn({ name: "id_cliente" })
  cliente!: Cliente;

  @Column({ type: "uuid" })
  id_ejecucion!: string;

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