; Registry entries that put Notes in the shell's "Open with" list.
;
; SHCTX follows the install mode, so a per-user install writes under HKCU and
; needs no elevation. Everything written here is removed on uninstall.

!macro NSIS_HOOK_POSTINSTALL
  ; Listed under "Open with" for any file type.
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" \
    "FriendlyAppName" "Notes"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\DefaultIcon" \
    "" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open" \
    "FriendlyAppName" "Notes"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" \
    "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'

  ; An earlier build also added a top-level "Open with Notes" item to every
  ; file's context menu. It belongs in the Open with submenu, not beside it, so
  ; upgrades clear the old key rather than leaving it behind.
  DeleteRegKey SHCTX "Software\Classes\*\shell\OpenWithNotes"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\*\shell\OpenWithNotes"
!macroend
