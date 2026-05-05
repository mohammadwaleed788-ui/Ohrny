export function PageContainer({ title, description, children }) {
  return (
    <main className="page-container">
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  )
}
