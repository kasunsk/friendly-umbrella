# PowerShell script to commit and push all changes
# This bypasses pager issues

Write-Host "Staging all changes..." -ForegroundColor Yellow
git add .

Write-Host "Checking status..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "Found changes to commit:" -ForegroundColor Green
    Write-Host $status
    
    Write-Host "`nCommitting changes..." -ForegroundColor Yellow
    git commit -m "chore: Normalize line endings and update project files"
    
    Write-Host "`nPushing to GitHub..." -ForegroundColor Yellow
    git push
    
    Write-Host "`nDone! All changes have been committed and pushed." -ForegroundColor Green
} else {
    Write-Host "No changes to commit." -ForegroundColor Green
}

Write-Host "`nFinal status:" -ForegroundColor Yellow
git status --short



