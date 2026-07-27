Que se necesita realizar?
==============================

- Se necesita generar un sofware que permita administrar los permisos administrativos de trabajadores de una empresa. 
- Se debe almacenar al menos los siguientes datos del trabajador:nombres, rut (con digito verificador), apellido paterno, apellido materno, titulo, cargo en la empresa, email.
- Se debe almacenar al menos la siguiente informacion del permiso administrativo; cantidad de dias que puede ser 1 o varios e incluso puede ser media jornada, fecha y hora en que se pide el permiso, estado del permiso
que puede ser "En revision", "Aprobado", "Rechazado", motivo del permiso.
- Se debe tener claro cuantos permisos administrativos tiene disponibles cada trabajador y cuantos permisos le quedan disponibles durante el año.

# Ingreso trabajador
Cada trabajador debe poder ingresar al sistema usando un usuario y contraseña y puede realizar las siguientes acciones:

- El trabajador puede ver sus propios permisos administrativos.
- El trabajador puede ver cuantos permisos administrativos a usado durante el año y cuantos tiene disponibles.
- El trabajador puede solicitar un nuevo permiso administrativo.
- El trabajador puede solicitar un permiso administrativo pero no puede editarlo (para evitar manipulacion sobre todo si son permisos con fecha anterior a la fecha de hoy o permisos que ya fueron aprobados).
- El trabajador no puede eliminar permisos que ya fueron aprobados o que tiene una fecha anterior a la fecha de hoy.
- ***El trabajador no puede ver ni consultar permisos administrativos de otros trabajadores***.

**cantidad de permisos disponibles por año**: Por defecto un trabajor tiene permitido 6 permisos por año, este valor debe ser posible configurarlo desde el frontend para el caso en que este valor cambie.

# Ingreso Jefatura

Debe existir un usuario con los permisos correspondiente (por ejemplo un usuario con rol jefatura) que pueda ver todo el historico de todos los trabajadores de la empresa, este usuario puede hacer las siguientes acciones:

- El usuario puede ver todos los permisos administrativos que tiene disponibles un trabajador en particular.
- El usuario puede ver cuantos permisos administrativos ha pedido durante el año el trabajador.
- El usuario pueder editar o eliminar un permiso administrativo, por ejemplo para cambiar el estado de "En revision" a  "Aprobado".
**Autorizacion Permiso Adminitrativo**: este usuario debe ser capaz de Aprobar o rechazar un permiso adminitrativo de un funcionario (cambiar el estado de "En revision" a "Aprobado"), se debe indicar el motivo en caso de que se rechaze un permiso adminitrativo.

# Reportes
- Cada trabajador debe poder generar si lo estima conveniente un reporte pdf con todos su permisos del año.

# Mail reportes
- Se debe poder enviar correos desde plataforma por ejemplo para indicar que su permiso administrativo fue aprobado o está en proceso de revision.

# Stack Tecnologico

## FrontEnd
- React
- Tailwind css

## Backend
- Express js
- Typescript
- JWT para autenticacion.

## Base de datos
- Postgresql 
- Las tablas de la base de datos siempre se tienen que crear usando archivos de migraciones con el formato standar timestamp

## Migraciones
- El codigo migraciones debe serguir la sintaxis: exports.up = (pgm) => {}; exports.down = (pgm) => {}
- Por standar usar el comando npm run migrate:up y npm run migrate:down para ejecutar las migraciones.

## Reportes
- usar de PDF kit para reportes pdf.
- Permitir la exportacion a excel.

### Sesiones, Autenticacion, roles, usuarios y permisos

#### Autenticacion 
- El sistema debe contar con sistema de autenticacion de usuarios a atraves de usuario y contraseña.
- El sistema debe permitir configurar para cada usuario doble factor de autenticacion usando google autenticator.
- El password del usuario siempre se debe almacenar encriptado en la tabla correspondiente.

#### Sesiones
- El sistema debe tener algun mecanismo para manejar las sesiones, usar pg-migrate para esto en posgresql.
- El sistema debe permitir ver, eliminar las sesiones de usuarios desde el frontend.
- El sistema debe permitir configurar desde el frontend la cantidad de tiempo que puede estar activa una sesion, por ejemplo: las sesiones de usuarios duren 2 horas.
- El sistema debe permitir configurar desde el frontend los dias de la semana que se puede acceder a sistema; por ejemplo solo permitir el ingreso de lunes a viernes o dias especificos de la semana.

#### Usuarios
- El sistema debe permitir, crear, editar, eliminar, suspender un usuario desde el frontend.
- Suspender un usuario implica denegar el acceso al sistema.

#### Roles
- El sistema debe permitir crear, editar, eliminar roles.
- Un usuario puede tener solo un rol, ejemplo: rol de administrador.

#### Permisos
- El sistema debe permitir gestionar los permisos que puede tener un determinado rol.
- El sistema debe permitir editar permisos por seccion. Ejemplo: Un usuario puede ver una seccion mas no editar ni eliminar.
- Se debe permitir gestionar los permisos por seccion para cada rol desde el frontend, debe existir una seccion o menu donde se pueda ver para cada seccion del sistema si el rol puede
crear, editar, eliminar, ver. para esa seccion etc.

#### Permisos a nivel de Endpoint
- Se debe implementar middleware que valide si el usuario tiene permisos para acceder a ese endpoint, en caso de no tener permisos, mostrar un mensaje claro desde el server hacia el backend.
Ejemplo: return res.status(400).json( { message: "No tienes permisos para utilizar esta funcion"} ). 
- Se debe implementar middleware que valide si el usuario esta autenticado antes de permitir utilizar el endpoint correspondiente.
- Mostar mensajes amigables al usuario en caso de que no tenga permisos para usar ese endpoint.

#### Seed
- Se debe crear un usuario a traves de seed como usuario inicial para configuracion, que tenga acceso a todo, user: admin, password: admin123.

# Codigo Buenas Practicas
- Cada feature que se cree o cada bug que se arregle se debe realizar su correspondiente test unitario, ya sea en el backend como en el frontend.
- Validar correctamente cada input, variable o data que se envie desde el frontend hacia el backend antes de realizar cualquier procedimiento con la base de datos.
- Realizar todas las validaciones correspondientes para evitar sql injection.

# Git
- Siempre usar monorepo.
- Solicitar url de github donde se deben subir el proyecto.
- Cada nueva feature o bug fix se debe realizar su correspondiente test unitario, si los test son correctos realizar correspondiente commit and push.

# Frontend style
- Usar tailwind css para los estilos.
- Utilizar skill disponible o buscar alguna skill que permita mejorar el "frontend design"
- De ser posible siempre dar prioridad a usar tablas para mostrar los resultados, y modal para crear o editar registros.

# Backend buenas practicas
- Usar alguna skill disponible para backend, usar de ser posible "nodejs-backend-patterns"

# Mobile First
- Preguntar si se necesita que el sistema sea mobile first, en caso se ser asi considerar que en disposivos mobiles se deben usar card para mostar registros pero en laptop y dispositivos de mayor resolucion
usar siempre tablas.

# Archivo readme
- Generar correspondiente readme que explique de manera clara que hace el software y como realizar su configuracion.

# Configuracion de correos
- Si el sistema necesita envios de correos usar por defecto smtp gmail con contraseñas de aplicacion. se debe poder configurar a traves de un formulario en el frontend toda esta informacion.
- Incluir style en los correos para que se vean mas profesionales, de ser posible usar plantilla html.

## LOG
- se debe crear un archivo txt que registre cada uno de los eventos del sistema, ingreso, errores.
- se debe registrar en una tabla todas las acciones que realiza cada usuario, indicando claramente que tipo de accion realizo y en que tabla, create, update, delete, etc.


 




 