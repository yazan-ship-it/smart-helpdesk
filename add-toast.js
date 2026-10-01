const fs = require('fs');
let c = fs.readFileSync('app/tickets/new/page.tsx', 'utf8');

if (!c.includes("useEffect(() => {")) {
  c = c.replace(/const \[title, setTitle\] = useState\(''\)\s*const \[description, setDescription\] = useState\(''\)\s*const \[selectedCategory, setSelectedCategory\] = useState\(''\)/, 
`const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    } else if (state?.fieldErrors) {
      toast.error('Please fix the validation errors before submitting.')
    }
  }, [state])`);
}

c = c.replace(/import \{ useActionState, useState, useRef, useCallback, useEffect \} from 'react'/, 
  "import { useActionState, useState, useRef, useCallback, useEffect } from 'react'");

fs.writeFileSync('app/tickets/new/page.tsx', c, 'utf8');
