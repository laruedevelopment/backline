import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Flag, Heart, MessageCircle, Trash2 } from 'lucide-react'
import { ago } from '../lib/ago'
import { addPostComment, deletePost, deletePostComment, listPostComments, profileCards, setLike, visibilityLabel, type Card, type FeedPost, type Stats } from '../lib/feed'
import { ask } from '../lib/confirm'
import { useAuth } from '../store/useAuth'
import Avatar from './Avatar'
import BandMark from './BandMark'
import { ReportSheet, type ReportTarget } from './ReportSheet'

type Props = { post: FeedPost; stats?: Stats; author?: Card; bandName?: string; urls: Map<string, string>; canModerate: boolean; onChanged: () => void }

const linkLabel = (u: string) => (/spotify/i.test(u) ? 'Spotify' : 'YouTube')

/** Una publicación del muro: quién, cuándo y para quién, el contenido, y me gusta, comentarios, denunciar y borrar. */
export default function PostCard({ post, stats, author, bandName, urls, canModerate, onChanged }: Props) {
  const me = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [report, setReport] = useState<ReportTarget | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const mine = post.author === me
  const liked = stats?.liked ?? false

  const like = useMutation({ mutationFn: () => setLike(post.id, me!, !liked), onSuccess: onChanged })
  const remove = useMutation({ mutationFn: () => deletePost(post), onSuccess: onChanged })
  const { data: comments = [] } = useQuery({ queryKey: ['post-comments', post.id], queryFn: () => listPostComments(post.id), enabled: open })
  const { data: cards } = useQuery({ queryKey: ['cards', comments.map((c) => c.author).sort().join(',')], queryFn: () => profileCards(comments.map((c) => c.author)), enabled: open && comments.length > 0 })
  const send = useMutation({
    mutationFn: () => addPostComment(post.id, draft),
    onSuccess: async () => { setDraft(''); await qc.invalidateQueries({ queryKey: ['post-comments', post.id] }); onChanged() },
  })
  const delComment = useMutation({ mutationFn: (id: string) => deletePostComment(id), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['post-comments', post.id] }); onChanged() } })

  const name = post.bandId && bandName ? bandName : author?.name ?? 'Músico'

  return (
    <article className="post">
      <header className="post-head">
        {post.bandId ? <BandMark name={name} /> : <Avatar name={name} url={author?.avatarUrl} />}
        <div className="post-who">
          <b>{name}</b>
          <span>{post.bandId && author ? `${author.name} · ` : ''}{ago(post.createdAt)} · {visibilityLabel[post.visibility]}</span>
        </div>
        {!mine && <button className="icon-quiet" onClick={() => setReport({ kind: 'post', id: post.id, label: 'esta publicación', excerpt: post.body })} aria-label="Denunciar publicación"><Flag size={16} aria-hidden /></button>}
        {(mine || canModerate) && (
          <button className="icon-quiet" aria-label="Borrar publicación" onClick={async () => { if (await ask({ title: '¿Borrar la publicación?', body: 'Se borra para todos, con sus fotos y comentarios.', confirmLabel: 'Borrar' })) remove.mutate() }}><Trash2 size={16} aria-hidden /></button>
        )}
      </header>
      {post.body && <p className="post-body">{post.body}</p>}
      {post.images.length > 0 && (
        <div className={`post-images n${post.images.length}`}>
          {post.images.map((p) => urls.get(p) ? <button key={p} type="button" className="post-img" onClick={() => setZoom(urls.get(p)!)} aria-label="Ver foto grande"><img src={urls.get(p)} alt="" loading="lazy" decoding="async" /></button> : <div key={p} className="post-img skeleton" />)}
        </div>
      )}
      {post.link && <a className="post-link" href={post.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden /> Abrir en {linkLabel(post.link)}</a>}
      <footer className="post-actions">
        <button className={`act ${liked ? 'on' : ''}`} onClick={() => like.mutate()} disabled={like.isPending} aria-pressed={liked} aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}><Heart size={18} fill={liked ? 'currentColor' : 'none'} aria-hidden /> {stats?.likes ?? 0}</button>
        <button className="act" onClick={() => setOpen((v) => !v)} aria-expanded={open}><MessageCircle size={18} aria-hidden /> {stats?.comments ?? 0}</button>
      </footer>
      {open && (
        <div className="post-comments">
          {comments.map((c) => {
            const a = cards?.get(c.author)
            return (
              <div key={c.id} className="pc">
                <Avatar name={a?.name ?? 'Músico'} url={a?.avatarUrl} size={28} />
                <div><b>{c.author === me ? 'Tú' : a?.name ?? 'Músico'}</b> <span className="li-sub">{ago(c.createdAt)}</span><p>{c.body}</p></div>
                {(c.author === me || mine) && <button className="icon-quiet" aria-label="Borrar comentario" onClick={() => delComment.mutate(c.id)}><Trash2 size={14} aria-hidden /></button>}
                {c.author !== me && <button className="icon-quiet" aria-label="Denunciar comentario" onClick={() => setReport({ kind: 'post_comment', id: c.id, label: 'este comentario', excerpt: c.body })}><Flag size={14} aria-hidden /></button>}
              </div>
            )
          })}
          <form className="thread-form" onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !send.isPending) send.mutate() }}>
            <input value={draft} maxLength={500} placeholder="Escribe un comentario…" aria-label="Comentar" onChange={(e) => setDraft(e.target.value)} />
            <button className="btn primary sm" disabled={!draft.trim() || send.isPending}>Comentar</button>
          </form>
        </div>
      )}
      {report && <ReportSheet target={report} onClose={() => setReport(null)} />}
      {zoom && <button className="lightbox" onClick={() => setZoom(null)} aria-label="Cerrar foto"><img src={zoom} alt="" /></button>}
    </article>
  )
}
