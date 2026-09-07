import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Cliente } from "./Cliente";

@Entity("serie_fibonacci")
export class SerieFibonacci {
  @PrimaryGeneratedColumn()
  id_fibonacci!: number;

  @ManyToOne(() => Cliente, (c) => c.fibonacci)
  @JoinColumn({ name: "id_cliente" })
  cliente!: Cliente;

  @Column({ type: "uuid" })
  id_ejecucion!: string;

  @Column()
  iteracion!: number;

  @Column({ type: "bigint" })
  fibonacci_n!: string;

  @Column({ type: "decimal", precision: 20, scale: 15 })
  razon_calculada!: string;

  @Column({ type: "decimal", precision: 20, scale: 15 })
  valor_real!: string;

  @Column({ type: "decimal", precision: 20, scale: 15 })
  error!: string;

  @Column({ type: "timestamp", default: () => "NOW()" })
  fecha_generacion!: Date;
}