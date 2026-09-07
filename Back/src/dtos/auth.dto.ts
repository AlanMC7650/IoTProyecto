export interface RegistroDTO {
  nombre: string;
  identificador: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}
