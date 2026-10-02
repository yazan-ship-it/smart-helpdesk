export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 bg-muted rounded w-48 mb-2"></div>
        <div className="h-4 bg-muted rounded w-full max-w-96"></div>
      </div>
      
      <div className="max-w-3xl space-y-6">
        <div className="h-48 bg-muted/50 rounded-2xl"></div>
        <div className="h-48 bg-muted/50 rounded-2xl"></div>
        <div className="h-48 bg-muted/50 rounded-2xl"></div>
      </div>
    </div>
  )
}
