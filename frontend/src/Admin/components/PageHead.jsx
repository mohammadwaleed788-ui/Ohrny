export function PageHead({ title, sub, actions }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-5">
      <div>
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.015em] text-neutral-100">{title}</h1>
        {sub ? <p className="mt-1 text-[13px] text-neutral-400">{sub}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

