from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class Trabajo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str = Field(index=True)
    descripcion: Optional[str] = None
    cliente_contacto: Optional[str] = None
    estado: str = Field(default="Planificado")  # Planificado, En Progreso, Seguimiento, Completado, Cancelado
    color: Optional[str] = Field(default="#3b82f6")  # Color en formato hexadecimal o CSS
    orden: int = Field(default=0)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.now)
    nota: Optional[str] = None  # Comentarios/Notas acumulativas con timestamp
    planta: Optional[str] = None  # 9901, 10.000, LDV, All
    tipo_actividad: Optional[str] = None  # Compras, Inversiones, Informe, Otros
    importancia: Optional[str] = None  # Prioritario, Importante, Estratégico
    
    actividades: List["Actividad"] = Relationship(
        back_populates="trabajo",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    tareas: List["Tarea"] = Relationship(
        back_populates="trabajo",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class Tarea(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str = Field(index=True)
    descripcion: Optional[str] = None
    prioridad: str = Field(default="Media")  # Alta, Media, Baja
    estado: str = Field(default="Pendiente")  # Pendiente, Seguimiento, Completada
    orden: int = Field(default=0)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.now)
    nota: Optional[str] = None
    planta: Optional[str] = None
    tipo_actividad: Optional[str] = None
    importancia: Optional[str] = None
    
    trabajo_id: Optional[int] = Field(default=None, foreign_key="trabajo.id", nullable=True)
    trabajo: Optional[Trabajo] = Relationship(back_populates="tareas")
    
    actividades: List["Actividad"] = Relationship(
        back_populates="tarea",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class Actividad(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str = Field(index=True)
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: str = Field(default="Planificado")  # Planificado, En Progreso, Seguimiento, Completado, Cancelado
    color: Optional[str] = Field(default="#3b82f6")
    orden: int = Field(default=0)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.now)
    nota: Optional[str] = None
    planta: Optional[str] = None
    tipo_actividad: Optional[str] = None
    importancia: Optional[str] = None
    tiempo_invertir: Optional[str] = None  # 15 min., 40 min., Horas
    duracion_minutos: Optional[int] = Field(default=0)
    completado: bool = Field(default=False)
    
    trabajo_id: Optional[int] = Field(default=None, foreign_key="trabajo.id", nullable=True)
    trabajo: Optional[Trabajo] = Relationship(back_populates="actividades")
    
    tarea_id: Optional[int] = Field(default=None, foreign_key="tarea.id", nullable=True)
    tarea: Optional[Tarea] = Relationship(back_populates="actividades")
