const fs = require('fs');
let c = fs.readFileSync('app/tickets/TicketListClient.tsx', 'utf8');

if (!c.includes('import { useRouter, usePathname }')) {
  c = c.replace(/import \{ useSearchParams \} from 'next\/navigation'/, "import { useSearchParams, useRouter, usePathname } from 'next/navigation'");
}
if (!c.includes("import { toast } from 'sonner'")) {
  c = c.replace(/import \{ useState, useMemo, useEffect, useRef, Suspense \} from 'react'/, "import { useState, useMemo, useEffect, useRef, Suspense } from 'react'\nimport { toast } from 'sonner'");
}

c = c.replace(/const searchParams = useSearchParams\(\)/, `const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  useEffect(() => {
    if (searchParams?.get('created') === 'true') {
      toast.success('Ticket created successfully')
      router.replace(pathname || '/tickets')
    }
  }, [searchParams, pathname, router])`);

c = c.replace(/<div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10">\s*<div className="relative flex-1">/, 
`<div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">`);

c = c.replace(/<Search className="absolute left-3 top-1\/2 -translate-y-1\/2 w-4 h-4 text-muted-foreground pointer-events-none" \/>\s*<\/div>\s*(<div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide shrink-0">\s*<div className="flex items-center bg-card border border-border rounded-lg p-1">)/, 
`<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          {(search || statusFilter || priorityFilter || categoryFilter || assignedToMeFilter) && (
            <button
              onClick={() => {
                setSearch('')
                router.push(pathname || '/tickets')
              }}
              className="btn bg-card text-muted-foreground border-border hover:bg-muted whitespace-nowrap text-xs h-9 px-3"
            >
              Clear filters
            </button>
          )}
        </div>
        $1`);

fs.writeFileSync('app/tickets/TicketListClient.tsx', c, 'utf8');
