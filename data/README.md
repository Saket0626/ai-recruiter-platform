# Resume files

Put your real PDF resume at `data/resume.pdf` after cloning. That path is gitignored.

The official resume is loaded locally from that path and shown on Dashboard and Settings. Do not commit it. Docker can copy it into a personal Railway image from the local file; GitHub never gets the PDF.

`npm run resume:generate` can write a starter PDF for local testing. Replace it with the real resume before sending.

Do not commit resumes, extracted profile dumps, or Gmail tokens.
