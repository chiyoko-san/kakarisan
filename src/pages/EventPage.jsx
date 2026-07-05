import React from 'react'
import { useUid, useEvent, EventView, ShareBox } from '../components.jsx'
import { eventUrl } from '../lib.js'

export default function EventPage({ eventId }) {
  const uid = useUid()
  const data = useEvent(eventId)

  return (
    <div className="page">
      <EventView eventId={eventId} data={data} uid={uid} isAdmin={false} />

      {data.meta ? (
        <div className="card paper">
          <h2 className="section-title">このページを広める</h2>
          <ShareBox url={eventUrl(eventId)} title={data.meta.title} />
        </div>
      ) : null}

      {data.meta ? (
        <p className="muted small center">
          記入の取り消しは、記入したときと同じ端末・ブラウザからのみできます。
          <br />
          間違えたときは幹事さんに削除を頼んでください。
        </p>
      ) : null}
    </div>
  )
}
