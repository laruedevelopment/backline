/** Textos legales. BORRADOR: debe revisarlos un abogado antes de abrir la app a personas fuera de la banda. */
export const TERMS_VERSION = '0.5'
export const CONTACT_EMAIL = 'javieruedase@gmail.com'
export const RESPONSIBLE = 'Javier Rueda'

export type LegalSection = { title: string; paragraphs?: string[]; bullets?: string[] }
export type LegalDoc = { title: string; intro?: string; sections: LegalSection[] }

export const privacy: LegalDoc = {
  title: 'Política de tratamiento de datos personales',
  intro: `Versión ${TERMS_VERSION} (borrador en revisión).`,
  sections: [
    {
      title: '1. Responsable',
      paragraphs: [`${RESPONSIBLE}, persona natural, Colombia. Correo de contacto: ${CONTACT_EMAIL}. Es el responsable provisional mientras se constituye la entidad que operará Backline.`],
    },
    {
      title: '2. Datos que recogemos',
      bullets: [
        'Al registrarte: nombre (como te dicen en la banda), correo electrónico y contraseña (se guarda cifrada; nosotros no la vemos).',
        'En tu perfil, de forma opcional: foto, instrumentos que tocas, ciudad, una descripción corta y un número de WhatsApp. La foto se recorta y se reduce en tu dispositivo y se le quita la ubicación (EXIF) antes de subirla.',
        'Datos de tu banda y de tu uso: bandas a las que perteneces y tu rol, repertorio, setlists, ensayos y toques, tu respuesta de asistencia y el instrumento que tocas en cada banda.',
        'Si reservas una sala de ensayo: la franja que pides, tu nombre, la nota y, si lo escribes, tu teléfono. Se comparten con el dueño de esa sala de ensayos para que pueda confirmarte. Si publicas tu propia sala de ensayos: sus datos de contacto, fotos, horarios y precios, visibles para las personas con cuenta en Backline.',
        'Logo y fotos de la banda que suban sus líderes o administradores. Antes de subirlas se reducen y se les quita la ubicación (EXIF).',
        'Enlaces de YouTube o Spotify, notas y, si la banda los escribe, la letra y los acordes de sus canciones.',
        'Los códigos y enlaces de invitación que generen los administradores de una banda (vencen a los 7 días).',
        'Tu decisión de hacer público, o no, tu perfil, y la de los administradores de tu banda sobre el perfil de la banda (ver sección 4).',
        'Al registrarte guardamos la fecha y la versión de los términos que aceptaste, y tu declaración de edad.',
        'Tu progreso de práctica, la banda activa y una copia de lo último que viste (para que la app funcione sin señal) se guardan en tu propio dispositivo.',
      ],
      paragraphs: [
        'No recogemos datos sensibles (salud, origen, orientación, etc.). Te pedimos no escribirlos en tu descripción ni en tus notas.',
        'No usamos analítica, publicidad ni cookies de seguimiento.',
      ],
    },
    {
      title: '3. Para qué los usamos',
      bullets: [
        'Crear y gestionar tu cuenta y verificar que eres tú.',
        'Permitir que tu banda comparta repertorio, setlists, letras y agenda.',
        'Mostrar tu perfil o el de tu banda en Comunidad, solo si tú o los administradores lo activan.',
        'Enviarte correos del servicio (confirmar la cuenta, recuperar la contraseña).',
        'Mantener la seguridad y prevenir abusos.',
        'Cumplir obligaciones legales.',
      ],
      paragraphs: ['No vendemos tus datos ni te enviamos publicidad sin una autorización aparte.'],
    },
    {
      title: '4. Quién ve tus datos',
      paragraphs: [
        'Por defecto, tu nombre, instrumentos, ciudad y descripción los ven solo las personas que integran las bandas de las que haces parte. El repertorio, los setlists, las letras, la agenda y las reservas de una banda son siempre privados de esa banda.',
        'Comunidad es opcional y está apagada por defecto. Si eres mayor de edad y activas «Perfil público», las demás personas con cuenta en Backline podrán ver tu foto, nombre, instrumentos, ciudad, descripción, tus bandas públicas y tu WhatsApp si lo escribiste. Si los administradores de una banda activan su perfil público, las personas con cuenta podrán ver su nombre, logo, ciudad, géneros, descripción, redes, fotos y los integrantes que hayan hecho público su perfil. Puedes apagarlo cuando quieras. Tu correo nunca se muestra. Quienes no tienen cuenta no ven estos perfiles.',
        'El logo y las fotos de una banda, y las fotos de perfil, se guardan en un espacio público de solo lectura: cualquier persona que tenga el enlace de la imagen puede verla. Si quitas tu foto o borras tu cuenta, se elimina el archivo.',
      ],
    },
    {
      title: '5. Terceros y transferencia internacional',
      bullets: [
        'Supabase Inc.: base de datos, autenticación y envío de los correos de la cuenta. Sus servidores están fuera de Colombia, lo que implica una transferencia internacional de datos. Más información en supabase.com/privacy.',
        'YouTube (Google) y Spotify: si pulsas reproducir en una canción, el reproductor se carga desde sus servidores y ellos pueden recibir tu dirección IP y datos del dispositivo, según sus propias políticas. No se carga nada de ellos hasta que pulses reproducir. Si importas una lista de YouTube, el identificador de esa lista se consulta a la API de Google.',
        'Alojamiento del sitio: GitHub Pages (GitHub, Inc.).',
        'La lectura de texto de fotos (OCR) se ejecuta en tu dispositivo: la imagen no se envía a nuestros servidores. Para funcionar, el lector descarga sus componentes desde un servicio de distribución de archivos de terceros.',
        'Mapas: si publicas un negocio con ubicación, el mapa que ven las bandas y la búsqueda de la dirección los provee OpenStreetMap (Nominatim); reciben las coordenadas o la dirección consultadas, no tus datos personales. Tu ubicación actual solo se lee cuando pulsas «Usar mi ubicación actual».',
        'Las tipografías se sirven desde nuestro propio sitio.',
      ],
    },
    {
      title: '6. Menores de edad',
      paragraphs: [
        'Backline no está dirigido a menores de 14 años. Entre 14 y 17 años solo puede usarse con autorización del padre, la madre o el representante legal, que puede dar o retirar escribiendo a ' + CONTACT_EMAIL + '. El tratamiento de datos de menores respeta su interés superior y sus derechos fundamentales.',
      ],
    },
    {
      title: '7. Tus derechos',
      paragraphs: ['Como titular puedes conocer, actualizar, rectificar y suprimir tus datos, pedir prueba de la autorización, ser informado del uso que se les da, revocar la autorización, presentar quejas ante la Superintendencia de Industria y Comercio y acceder gratis a tus datos.'],
      bullets: [
        'Directo en la app: Perfil para editar tus datos y "Borrar mi cuenta" para eliminarlos.',
        `Por correo a ${CONTACT_EMAIL}. Indica tu nombre, el correo de tu cuenta y qué pides. Consultas: respuesta en máximo 10 días hábiles. Reclamos: máximo 15 días hábiles.`,
      ],
    },
    {
      title: '8. Conservación',
      paragraphs: ['Mientras tengas cuenta. Al borrarla eliminamos tu perfil, tus respuestas de asistencia y las bandas en las que eras el único integrante. Las copias de respaldo del proveedor pueden conservarse por un tiempo limitado.'],
    },
    {
      title: '9. Seguridad',
      paragraphs: ['Conexión cifrada, contraseñas cifradas y control de acceso por banda. Ningún sistema es 100 % seguro: avísanos si detectas un problema.'],
    },
    {
      title: '10. Cambios',
      paragraphs: ['Si cambiamos esta política de forma importante te avisaremos en la app y, si hace falta, te pediremos de nuevo tu autorización.'],
    },
  ],
}

export const terms: LegalDoc = {
  title: 'Términos de uso',
  intro: `Versión ${TERMS_VERSION} (borrador en revisión).`,
  sections: [
    {
      title: '1. Qué es Backline',
      paragraphs: ['Una herramienta para organizar bandas: repertorio, setlists, ensayos y toques. Hoy es gratuita y está en desarrollo; puede cambiar, tener errores o interrumpirse.'],
    },
    {
      title: '2. Tu cuenta',
      paragraphs: ['Debes dar datos verdaderos, cuidar tu contraseña y responder por lo que se haga con tu cuenta. Edad mínima: 18 años. Entre 14 y 17 años solo con autorización del padre, la madre o el representante legal. Menores de 14 años no pueden usar Backline.'],
    },
    {
      title: '3. Tu contenido',
      paragraphs: ['Lo que escribes (nombres, notas, descripciones, setlists, letras y acordes) sigue siendo tuyo. Nos autorizas a guardarlo y mostrarlo a los integrantes de tu banda para que el servicio funcione. Garantizas que tienes derecho a publicarlo, que las fotos y el logo que subas son tuyos o tienes permiso de quienes aparecen en ellos, y que no subes contenido de otras personas sin permiso. Podemos retirar imágenes que incumplan estos términos.'],
    },
    {
      title: '4. Música de terceros',
      paragraphs: [
        'Backline no aloja ni distribuye música ni videos de terceros: solo guarda enlaces a YouTube y Spotify y muestra sus reproductores oficiales. No ofrecemos un catálogo de letras. Lo que una banda escribe en «Letra y acordes» es contenido de la banda, visible solo para sus integrantes, y cada banda es responsable de usar solo textos que tenga derecho a copiar y compartir entre sus miembros. La música y las letras siguen sujetas a las condiciones de las plataformas y a los derechos de sus titulares.',
        `Si eres titular de derechos y crees que hay una infracción, escribe a ${CONTACT_EMAIL} con la información del contenido y tu legitimación; lo revisaremos y retiraremos lo que corresponda.`,
      ],
    },
    {
      title: '5. Conducta',
      paragraphs: ['No uses Backline para acosar, suplantar, engañar, publicar contenido ilegal, violento, discriminatorio o sexual que involucre menores, ni para vulnerar la seguridad del servicio. Podemos suspender las cuentas que incumplan.'],
    },
    {
      title: '6. Salas de ensayos y reservas',
      paragraphs: [
        'Backline conecta bandas con salas de ensayos y otros negocios musicales; no es parte del contrato entre ellos. Una solicitud solo se vuelve reserva cuando la sala de ensayos la confirma. Backline no cobra ni procesa pagos: el pago y las condiciones de uso de la sala se acuerdan directamente con ella.',
        'Quien publica una sala de ensayos responde por la veracidad de sus datos, horarios y precios, y por atender o cancelar a tiempo las reservas que confirme. Quien reserva debe cancelar con anticipación si no puede asistir.',
      ],
    },
    {
      title: '7. Líderes de banda',
      paragraphs: ['Quien crea una banda la administra, invita integrantes y puede traspasar el liderazgo. Si una banda se queda sin integrantes, se elimina.'],
    },
    {
      title: '8. Borrado y suspensión',
      paragraphs: ['Puedes borrar tu cuenta cuando quieras desde tu perfil. Podemos suspender o cerrar cuentas que incumplan estos términos o por razones de seguridad.'],
    },
    {
      title: '9. Responsabilidad',
      paragraphs: ['El servicio se ofrece "como está" y no garantizamos que esté libre de errores. Respondemos en los términos que la ley colombiana no permita excluir.'],
    },
    {
      title: '10. Datos personales',
      paragraphs: ['Se tratan según la Política de tratamiento de datos personales.'],
    },
    {
      title: '11. Ley aplicable y contacto',
      paragraphs: [`Ley colombiana. Dudas o reclamos: ${CONTACT_EMAIL}. Hoy el servicio es gratuito; si más adelante hay cobros, se aplicarán también los derechos de la Ley 1480 de 2011.`],
    },
  ],
}
