# Copiar este archivo como config.py y completar los dos datos del proyecto de Supabase.
# Es el MISMO archivo para todos los ESP32: no lleva el Wi-Fi ni ninguna clave propia
# del dispositivo (el Wi-Fi se configura desde el celular y el token llega solo).
# config.py no se sube al repo (está en .gitignore).

# Supabase -> Project Settings -> Data API (URL del proyecto)
SUPABASE_URL = "https://xxxxxxxxxxxxxxxxxxxx.supabase.co"

# Supabase -> Project Settings -> API Keys -> clave "anon" o "publishable".
# Es pública por diseño: con RLS activado solo permite ejecutar las funciones
# anunciar_dispositivo y registrar_lecturas.
SUPABASE_ANON_KEY = "pegar_aqui_la_clave_publica"

# Muchos módulos relé se activan con nivel bajo (LOW). Si el relé hace lo
# contrario de lo esperado, cambiar a False.
RELE_ACTIVO_EN_ALTO = True
