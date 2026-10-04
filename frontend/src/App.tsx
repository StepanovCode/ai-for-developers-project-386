import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function App() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">Технический каркас</p>
          <CardTitle>
            <h1 className="text-3xl font-semibold tracking-tight">Календарь звонков</h1>
          </CardTitle>
          <CardDescription>Стартовая страница приложения.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Интерфейс подготовлен. Возможности приложения будут добавлены позже.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

export default App
