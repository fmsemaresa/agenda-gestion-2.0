import os
from datetime import datetime, timedelta
from sqlmodel import SQLModel, create_engine, Session, select
from models import Trabajo, Tarea, Actividad

# Usar DATABASE_URL de Render en producción, o SQLite local en desarrollo
database_url = os.getenv("DATABASE_URL", "sqlite:///agenda.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(database_url, connect_args=connect_args)

def init_db():
    # Crear tablas si no existen
    SQLModel.metadata.create_all(engine)
    
    from sqlalchemy import text
    
    migrations = [
        # Actividad columns
        ("actividad", "duracion_minutos", "INTEGER"),
        ("actividad", "completado", "INTEGER DEFAULT 0"),
        ("actividad", "tarea_id", "INTEGER"),
        # Tarea columns
        ("tarea", "fecha_creacion", "TIMESTAMP"),
        ("tarea", "nota", "TEXT"),
        ("tarea", "planta", "TEXT"),
        ("tarea", "tipo_actividad", "TEXT"),
        ("tarea", "importancia", "TEXT"),
    ]
    
    with Session(engine) as session:
        for table, col, col_type in migrations:
            try:
                session.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                session.commit()
                print(f"Migración: Columna '{col}' agregada a tabla '{table}'.")
            except Exception:
                session.rollback()
                
        # Migrar datos de nota_final a la nueva columna nota si existen y setear duracion_minutos default a 0
        try:
            session.execute(text("UPDATE trabajo SET nota = nota_final WHERE nota IS NULL AND nota_final IS NOT NULL"))
            session.execute(text("UPDATE tarea SET nota = nota_final WHERE nota IS NULL AND nota_final IS NOT NULL"))
            session.execute(text("UPDATE actividad SET duracion_minutos = 0 WHERE duracion_minutos IS NULL"))
            session.commit()
            print("Migración: Historial de notas y duracion_minutos inicializados con éxito.")
        except Exception:
            session.rollback()
            
        # Migrar To-Dos antiguos a Actividades
        try:
            # Verificar si existe la tabla antigua itemtodo
            res = session.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='itemtodo'")).fetchone()
            if res:
                # Obtener todos los ítems de itemtodo
                todos = session.execute(text("SELECT id, texto, completado, fecha_creacion, orden, tarea_id FROM itemtodo")).fetchall()
                for td_id, texto, completado, fecha_creacion, orden, tarea_id in todos:
                    # Validar si ya existe una actividad equivalente para evitar duplicados
                    check = session.execute(text("SELECT id FROM actividad WHERE titulo = :texto AND tarea_id = :tarea_id"), {"texto": texto, "tarea_id": tarea_id}).fetchone()
                    if not check:
                        # Convertir fechas de texto a datetime si vienen como str
                        f_creacion = fecha_creacion
                        if isinstance(f_creacion, str):
                            try:
                                f_creacion = datetime.strptime(f_creacion.split(".")[0], "%Y-%m-%d %H:%M:%S")
                            except:
                                f_creacion = datetime.now()
                        elif not f_creacion:
                            f_creacion = datetime.now()
                            
                        session.execute(text("""
                            INSERT INTO actividad (titulo, completado, fecha_creacion, orden, tarea_id, estado, color)
                            VALUES (:texto, :completado, :fecha_creacion, :orden, :tarea_id, :estado, '#6B7280')
                        """), {
                            "texto": texto,
                            "completado": 1 if completado else 0,
                            "fecha_creacion": f_creacion,
                            "orden": orden,
                            "tarea_id": tarea_id,
                            "estado": "Completada" if completado else "Planificado"
                        })
                session.commit()
                print("Migración: Todos los To-Dos de la tabla antigua 'itemtodo' han sido migrados a 'actividad'.")
        except Exception as e:
            session.rollback()
            print("Aviso: No se pudieron migrar los To-Dos antiguos o ya se habían migrado:", e)
            
    print("Base de datos inicializada y tablas verificadas/creadas.")
