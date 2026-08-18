; Registry entries that put Notes in the shell's "open with" surfaces.
;
; SHCTX follows the install mode, so a per-user install writes under HKCU and
; needs no elevation. Everything written here is removed on uninstall.

!macro NSIS_HOOK_POSTINSTALL
  ; Listed under "Open with > Choose another app" for any file type.
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" \
    "FriendlyAppName" "Notes"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\DefaultIcon" \
    "" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open" \
    "FriendlyAppName" "Notes"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" \
    "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'

  ; And a direct entry on the context menu of every file, which is what the
  ; "Open with" submenu alone does not give you without extra clicks.
  WriteRegStr SHCTX "Software\Classes\*\shell\OpenWithNotes" "" "Open with Notes"
  WriteRegStr SHCTX "Software\Classes\*\shell\OpenWithNotes" \
    "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHCTX "Software\Classes\*\shell\OpenWithNotes\command" \
    "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\*\shell\OpenWithNotes"
!macroend
