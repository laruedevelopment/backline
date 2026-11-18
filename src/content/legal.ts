/** Textos legales. BORRADOR: debe revisarlos un abogado antes de abrir la app a personas fuera de la banda. */
export const TERMS_VERSION = '0.8'
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
        'Mensajes que escribes: los del chat de tu banda y los comentarios por canción los ven los integrantes de esa banda (incluidos los invitados mientras dure su acceso) y los administradores de la banda pueden borrarlos. Los mensajes directos solo los ven quien los envía y quien los recibe.',
        'Amistades y bloqueos: a quién enviaste o aceptaste una solicitud de amistad y a quién bloqueaste. Esta lista es privada.',
        'Publicaciones «Se busca músico» de una banda pública y las respuestas de quienes se postulan, que ve la banda; quien responde comparte con la banda su nombre, foto, instrumentos, ciudad y el mensaje que escribe.',
        'Invitados por días: si una banda te invita como invitado, accedes a su repertorio, setlists, letras, notas y agenda hasta que venza el plazo; después sales sola de la banda.',
        'Avisos push: si los activas en tu perfil, guardamos la suscripción de tu navegador o dispositivo para avisarte de mensajes, solicitudes y reservas. Puedes desactivarlos cuando quieras.',
        'Muro: lo que publicas (texto, fotos y links) y quién lo ve (público, amigos o tu banda), tus «me gusta», comentarios y a quién sigues. Las fotos del muro y del Mercado se guardan en un espacio privado: solo las ven las personas que pueden ver esa publicación o ese anuncio.',
        'Mercado: los anuncios que publicas (título, descripción, precio, fotos, ciudad y, si tú lo decides, tu WhatsApp), las preguntas públicas y las respuestas.',
        'Denuncias que envías sobre contenido o personas, con el motivo y un extracto; son privadas.',
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
        'Permitir la comunicación entre integrantes de una banda y entre personas adultas que son amigas en Backline, y enviarte avisos sobre mensajes, solicitudes y reservas.',
        'Atender denuncias de contenido, mantener la seguridad y prevenir abusos.',
        'Cumplir obligaciones legales.',
      ],
      paragraphs: ['No vendemos tus datos ni te enviamos publicidad sin una autorización aparte.'],
    },
    {
      title: '4. Quién ve tus datos',
      paragraphs: [
        'Por defecto, tu nombre, instrumentos, ciudad y descripción los ven solo las personas que integran las bandas de las que haces parte. El repertorio, los setlists, las letras, la agenda y las reservas de una banda son siempre privados de esa banda.',
        'Comunidad es opcional y está apagada por defecto. Si eres mayor de edad y activas «Perfil público», las demás personas con cuenta en Backline podrán ver tu foto, nombre, instrumentos, ciudad, descripción, tus bandas públicas y tu WhatsApp si lo escribiste. Si los administradores de una banda activan su perfil público, las personas con cuenta podrán ver su nombre, logo, ciudad, géneros, descripción, redes, fotos y los integrantes que hayan hecho público su perfil. Puedes apagarlo cuando quieras. Tu correo nunca se muestra. Quienes no tienen cuenta no ven estos perfiles.',
        'Link público de un setlist: los administradores de una banda pueden crear un enlace que cualquier persona puede abrir sin cuenta. Muestra el nombre de la banda, el del setlist y, de cada canción, título, artista, tono, BPM, duración y etiquetas; no muestra letras, notas ni integrantes. Quien administra puede apagarlo en cualquier momento.',
        'Mensajes directos: solo entre personas mayores de edad que son amigas. Quien bloquea a otra persona deja de recibir sus solicitudes y mensajes.',
        'El logo y las fotos de una banda, y las fotos de perfil, se guardan en un espacio público de solo lectura: cualquier persona que tenga el enlace de la imagen puede verla. Si quitas tu foto o borras tu cuenta, se elimina el archivo.',
      ],
    },
    {
      title: '5. Terceros y transferencia internacional',
      bullets: [
        'Supabase Inc.: base de datos, autenticación y envío de los correos de la cuenta. Sus servidores están fuera de Colombia, lo que implica una transferencia internacional de datos. Más información en supabase.com/privacy.',
        'YouTube (Google) y Spotify: si pulsas reproducir en una canción, el reproductor se carga desde sus servidores y ellos pueden recibir tu dirección IP y datos del dispositivo, según sus propias políticas. No se carga nada de ellos hasta que pulses reproducir. Si importas una lista de YouTube, el identificador de esa lista se consulta a la API de Google.',
        'Alojamiento del sitio: GitHub Pages (GitHub, Inc.).',
        'Avisos push: el servicio de avisos de tu navegador (Google, Apple o Mozilla, según tu dispositivo) recibe el identificador de tu suscripción y el aviso que enviamos.',
        'La lectura de texto de fotos (OCR) se ejecuta en tu dispositivo: la imagen no se envía a nuestros servidores. Para funcionar, el lector descarga sus componentes desde un servicio de distribución de archivos de terceros.',
        'Mapas: si publicas un negocio con ubicación, el mapa que ven las bandas y la búsqueda de la dirección los provee OpenStreetMap (Nominatim); reciben las coordenadas o la dirección consultadas, no tus datos personales. Tu ubicación actual solo se lee cuando pulsas «Usar mi ubicación actual».',
        'Las tipografías se sirven desde nuestro propio sitio.',
      ],
    },
    {
      title: '6. Menores de edad',
      paragraphs: [
        'Las personas de 14 a 17 años pueden usar el chat y los comentarios de las bandas en las que participan, que también pueden incluir personas adultas. No pueden tener perfil público ni usar mensajes directos ni amistades.',
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
      paragraphs: ['Mientras tengas cuenta. Al borrarla eliminamos tu perfil, tus mensajes del chat de banda, comentarios y mensajes directos (incluidos los que estaban en la conversación de otra persona), tus amistades, bloqueos, respuestas, suscripciones de avisos, respuestas de asistencia y las bandas en las que eras el único integrante. Los datos de contacto de reservas se anonimizan. Las copias de respaldo del proveedor pueden conservarse por un tiempo limitado. Las denuncias de contenido se conservan para proteger a otras personas.'],
    },
    {
      title: '9. Seguridad',
      paragraphs: ['Conexión cifrada, contraseñas cifradas y control de acceso por banda. Si la app falla guardamos un registro técnico (mensaje del error, pantalla, tipo de dispositivo y tu identificador) para poder corregirlo; se borra a los 30 días. Ningún sistema es 100 % seguro: avísanos si detectas un problema.'],
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
        'Cada persona y cada banda es la única responsable del contenido que sube o escribe (canciones, letras, acordes, setlists, textos, fotos, videos, mensajes y publicaciones) y de tener los derechos o permisos para usarlo. Backline actúa como intermediario técnico: no revisa el contenido antes de que se publique, no lo edita y no responde por las infracciones de derechos de autor ni por los reclamos de terceros que provengan de lo que suben los usuarios. Quien suba contenido se obliga a mantener indemne a Backline frente a esos reclamos.',
        `Si eres titular de derechos y crees que hay una infracción, escribe a ${CONTACT_EMAIL} con tu nombre y contacto, la obra y la prueba de que eres titular o tienes autorización, dónde está el contenido y una declaración de buena fe. Lo revisaremos y, si corresponde, retiraremos el contenido y avisaremos a quien lo subió, que podrá responder.`,
      ],
    },
    {
      title: '5. Conducta y convivencia',
      paragraphs: [
        'Reglas de convivencia: no se permite el acoso, las amenazas, el discurso de odio, publicar datos personales de otras personas sin su permiso, ni contactar a otros con fines comerciales no solicitados o de spam. Cada persona puede bloquear a otra y denunciar contenido desde la app o por correo. Podemos retirar contenido y suspender cuentas.','No uses Backline para acosar, suplantar, engañar, publicar contenido ilegal, violento, discriminatorio o sexual que involucre menores, ni para vulnerar la seguridad del servicio. Podemos suspender las cuentas que incumplan.'],
    },
    {
      title: '5 bis. Mensajes y comunicación',
      paragraphs: ['El chat de banda y los comentarios los ven todos los integrantes de esa banda, incluidos los administradores, que pueden borrarlos. Los mensajes directos no se revisan de forma habitual: solo si hay una denuncia o una obligación legal. No uses Backline para enviar publicidad o cobros a otras personas sin su autorización. Las personas menores de edad pueden estar en el chat de bandas que también tienen personas adultas; no pueden usar mensajes directos.'],
    },
    {
      title: '5 ter. Muro y Mercado',
      paragraphs: [
        'El muro y el Mercado son solo para personas mayores de edad; las personas menores solo ven lo que su banda publica para sus integrantes. Cada persona es responsable de lo que publica y de tener el derecho y el permiso de quienes aparecen en sus fotos; no publiques fotos de menores de edad ni de personas que no quieran aparecer. Puedes denunciar cualquier publicación, comentario, anuncio o perfil, y podemos retirarlos y suspender cuentas.',
        'El Mercado es solo un tablón de anuncios entre personas: Backline no vende, no cobra, no procesa pagos, no entrega ni garantiza productos, ni verifica a quien publica. Publica solo equipo que sea tuyo y descríbelo con sinceridad. Encuéntrate en un lugar público, no adelantes dinero y revisa el equipo antes de pagar. Está prohibido publicar equipo robado, falsificado o ilegal. Si más adelante hay pagos dentro de la app, se aplicarán los derechos del consumidor (Ley 1480 de 2011).',
      ],
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
