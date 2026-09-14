# Resume files

Put your real PDF resume at `data/resume.pdf` after cloning. That path is gitignored and CI fails if it is ever tracked again.

Do not commit the official resume. Tests and `npm run resume:generate` use `data/fixtures/` only.

The official resume is loaded locally from `RESUME_PATH` (default `data/resume.pdf`) and shown on Dashboard and Settings. Docker/Railway must receive the file from a volume or secret mount, not from GitHub.

`npm run resume:generate` can write a starter PDF for local testing. Replace it with the real resume before sending.

Do not commit resumes, extracted profile dumps, or Gmail tokens.
