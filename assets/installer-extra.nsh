; installer-extra.nsh
; Custom NSIS script for Spotix Scanner installer
; Adds download buttons for Terms & Conditions and Operation Guide

; ─── Branding ─────────────────────────────────────────────────────────────────
Name "Spotix Scanner"
Caption "Spotix Scanner — Professional Event Check-in System"
BrandingText "Spotix Scanner v${VERSION} · spotix.com.ng"

; ─── Welcome page customization ───────────────────────────────────────────────
!define MUI_WELCOMEPAGE_TITLE "Welcome to Spotix Scanner"
!define MUI_WELCOMEPAGE_TEXT "Spotix Scanner is a professional offline event check-in system.$\r$\n$\r$\nThis wizard will guide you through the installation of Spotix Scanner on your computer.$\r$\n$\r$\nBefore installing, please review the Terms & Conditions and the Operation Guide using the buttons below.$\r$\n$\r$\nClick Next to continue."

; ─── Finish page customization ────────────────────────────────────────────────
!define MUI_FINISHPAGE_TITLE "Spotix Scanner Installed"
!define MUI_FINISHPAGE_TEXT "Spotix Scanner has been installed on your computer.$\r$\n$\r$\nYou can find the Operation Guide and Terms & Conditions in the installation folder.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Spotix Scanner.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Spotix Scanner"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\resources\operation-guide.pdf"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Open Operation Guide (PDF)"

; ─── Custom page: Docs ────────────────────────────────────────────────────────
; Injected between Welcome and License pages
; Provides buttons to open Terms and Guide PDFs before proceeding

Var DocsDialog
Var DocsLabel
Var TermsButton
Var GuideButton
Var DocsNote

Function DocsPageCreate
  nsDialogs::Create 1018
  Pop $DocsDialog
  ${If} $DocsDialog == error
    Abort
  ${EndIf}

  ; Title label
  ${NSD_CreateLabel} 0 0 100% 20u "Documents"
  Pop $DocsLabel
  SetCtlColors $DocsLabel 0x000000 transparent
  CreateFont $0 "DM Sans" 12 700
  SendMessage $DocsLabel ${WM_SETFONT} $0 1

  ; Description
  ${NSD_CreateLabel} 0 25u 100% 30u "Please review the following documents before proceeding with the installation."
  Pop $0

  ; Terms button
  ${NSD_CreateButton} 0 65u 48% 20u "📄  Terms & Conditions"
  Pop $TermsButton
  ${NSD_OnClick} $TermsButton DocsOpenTerms

  ; Guide button
  ${NSD_CreateButton} 52% 65u 48% 20u "📘  Operation Guide"
  Pop $GuideButton
  ${NSD_OnClick} $GuideButton DocsOpenGuide

  ; Note
  ${NSD_CreateLabel} 0 95u 100% 20u "Both documents will also be available in the installation folder after setup."
  Pop $DocsNote

  nsDialogs::Show
FunctionEnd

Function DocsOpenTerms
  ; Extract terms PDF temporarily and open it
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=terms.pdf "${BUILD_RESOURCES_DIR}\terms.pdf"
  ExecShell "open" "$PLUGINSDIR\terms.pdf"
FunctionEnd

Function DocsOpenGuide
  ; Extract guide PDF temporarily and open it
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=operation-guide.pdf "${BUILD_RESOURCES_DIR}\operation-guide.pdf"
  ExecShell "open" "$PLUGINSDIR\operation-guide.pdf"
FunctionEnd

Function DocsPageLeave
  ; No validation needed — viewing docs is optional
FunctionEnd

; ─── Copy docs to install dir ─────────────────────────────────────────────────
!macro customInstall
  SetOutPath "$INSTDIR\resources"
  File "${BUILD_RESOURCES_DIR}\terms.pdf"
  File "${BUILD_RESOURCES_DIR}\operation-guide.pdf"
  DetailPrint "Installed Terms & Conditions and Operation Guide"
!macroend

; ─── Insert custom docs page ──────────────────────────────────────────────────
!macro customWelcomePage
  Page custom DocsPageCreate DocsPageLeave
!macroend
