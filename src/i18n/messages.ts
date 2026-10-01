import { EXTRACTED_AR, EXTRACTED_EN, EXTRACTED_FR } from './messages.generated'

export type Language = string

export const SUPPORTED_LANGUAGES: Language[] = ['fr', 'en', 'ar']

export const LANGUAGE_LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
}

export const LOCALES: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  ar: 'ar',
}

export const RTL_LANGUAGES: string[] = ['ar']

export function isRtl(language: string): boolean {
  return RTL_LANGUAGES.includes(language)
}

export function languageLabel(language: string): string {
  return LANGUAGE_LABELS[language] ?? language.toUpperCase()
}

type Messages = Record<string, string>

const fr: Messages = {
  'common.loading': 'Chargement…',
  'common.refresh': 'Actualiser',
  'common.reload': 'Recharger',
  'common.close': 'Fermer',
  'common.previous': 'Précédent',
  'common.next': 'Suivant',
  'common.page': 'Page',
  'common.item': 'élément',
  'common.items': 'éléments',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.required': 'Obligatoire',
  'common.noElements': 'Aucun élément',
  'common.noData': 'Aucune donnée à afficher.',

  'dialog.ok': 'OK',
  'dialog.confirm': 'Confirmer',
  'dialog.confirmTitle': 'Confirmation',
  'dialog.infoTitle': 'Information',
  'dialog.successTitle': 'Succès',
  'dialog.warningTitle': 'Attention',
  'dialog.errorTitle': 'Erreur',
  'dialog.input': 'Votre réponse',

  'app.logout': 'Quitter',
  'app.profile': 'Profil',
  'app.viewProfile': 'Voir mon profil',
  'app.dashboard': 'Tableau de bord',
  'app.language': 'Langue',
  'app.selectLanguage': 'Changer de langue',

  'nav.group.management': 'Gestion',
  'nav.group.activity': 'Activité',
  'nav.group.finance': 'Finance',
  'nav.group.space': 'Espace',
  'nav.group.socs': 'Sociétés',
  'nav.group.admin': 'Administration',

  'nav.dashboard': 'Tableau de bord',
  'nav.clients': 'Clients',
  'nav.suppliers': 'Fournisseurs',
  'nav.projects': 'Projets',
  'nav.activityTypes': 'Types d’activités',
  'nav.activities': 'Activités & tarifs',
  'nav.consultants': 'Collaborateurs',
  'nav.missions': 'Missions',
  'nav.myActivities': 'Mes Activités',
  'nav.cra': 'CRA',
  'nav.unavailability': 'Indisponibilités',
  'nav.expenses': 'Notes de frais',
  'nav.holidays': 'Jours fériés',
  'nav.billing': 'Facturation',
  'nav.payslips': 'Fiches de paie',
  'nav.documents': 'Documents',
  'nav.messages': 'Messages',
  'nav.support': 'Support',
  'nav.settings': 'Paramètres',
  'nav.demoSoc': 'Société démo',
  'nav.mySocs': 'Mes sociétés',
  'nav.allSocs': 'Toutes les sociétés',
  'nav.tables': 'Base de données',
  'nav.logs': 'Logs du serveur',
  'nav.languages': 'Langues',

  'login.subtitle': 'Connectez-vous à votre espace',
  'login.username': 'Email ou identifiant',
  'login.usernamePlaceholder': 'email ou identifiant',
  'login.password': 'Mot de passe',
  'login.showPassword': 'Afficher le mot de passe',
  'login.forgot': 'Mot de passe oublié ?',
  'login.submit': 'Se connecter',
  'login.noAccount': 'Votre société n’a pas encore de compte ?',
  'login.register': 'Inscrire ma société',

  'settings.title': 'Paramètres',
  'settings.subtitle': 'Personnalisez l’application',
  'settings.language.title': 'Langue de l’application',
  'settings.language.description':
    'Choisissez la langue de l’interface. Par défaut, celle de votre navigateur.',
  'settings.language.field': 'Langue',
  'settings.language.browser': 'Langue du navigateur',
  'settings.language.saved': 'Langue mise à jour.',
  'settings.fontSize.title': 'Taille de police de l’application',
  'settings.fontSize.description':
    'Choisissez la taille du texte affichée dans toute l’application (11 à 24 px).',
  'settings.fontSize.field': 'Taille (px)',
  'settings.fontSize.preview': 'Aperçu : ceci est un exemple de texte à cette taille.',
  'settings.theme.title': 'Thème de l’application',
  'settings.theme.description':
    'Choisissez la couleur principale de l’application parmi les 10 thèmes disponibles.',
  'settings.theme.field': 'Thème',
  'settings.theme.preview': 'Aperçu : ceci est un exemple de texte aux couleurs du thème.',
  'settings.pageSize.title': 'Nombre de lignes par page',
  'settings.pageSize.description':
    'Nombre de lignes affichées par table, le reste étant accessible via les boutons Précédent / Suivant.',
  'settings.pageSize.field': 'Lignes par page',
  'settings.colors.title': 'Couleurs des tables',
  'settings.colors.description':
    'Personnalisez la couleur d’en-tête et la bordure des tableaux de l’application.',
  'settings.colors.header': 'Couleur d’en-tête',
  'settings.colors.border': 'Couleur de bordure',
  'settings.buttons.title': 'Boutons',
  'settings.buttons.description':
    'Personnalisez la largeur et les couleurs des boutons de l’application.',
  'settings.buttons.smallWidth': 'Largeur petit texte (px)',
  'settings.buttons.largeWidth': 'Largeur texte long (px)',
  'settings.buttons.saveColor': 'Couleur bouton Enregistrer',
  'settings.buttons.deleteColor': 'Couleur bouton Supprimer',
  'settings.buttons.preview': 'Aperçu',
  'settings.background.title': 'Fond de l’application',
  'settings.background.description':
    'Couleur de dégradé du fond de toutes les pages.',
  'settings.background.color': 'Couleur du fond',
  'settings.background.preview': 'Aperçu du fond',
  'settings.saved': 'Préférences enregistrées.',
  'settings.preview': 'Aperçu',
  'settings.example': 'Exemple',
  'settings.row': 'Ligne',
  'settings.content': 'Contenu',
  'languages.searchRows': 'Rechercher une ligne',
  'languages.searchPlaceholder': 'clé ou valeur…',
  'CraDetail.declarer.une.absence': 'Déclarer une absence',
  'CraDetail.absences.declarees': 'Absences déclarées',
  'CraDetail.absence.info':
    "L'absence est soumise au manager en même temps que le CRA. Le CRA ne peut être validé qu'après validation de l'absence.",
  'CraDetail.aucune.absence.declaree': 'Aucune absence déclarée.',
  'CraDetail.valider.l.absence': "Valider l'absence",
  'CraDetail.rejeter.l.absence': "Rejeter l'absence",
  'CraDetail.le.type.d.absence.est.obligatoire': "Le type d'absence est obligatoire",
  'CraDetail.les.dates.sont.obligatoires': 'Les dates de début et de fin sont obligatoires',
  'CraDetail.indispos.a.valider': 'Indisponibilités à valider',
  'CraDetail.indispos.a.valider.info':
    'Le CRA ne peut pas être validé tant que ces indisponibilités ne sont pas validées.',
  'CraDetail.indispo.date.debut': 'Date de début',
  'CraDetail.indispo.date.fin': 'Date de fin',
  'CraDetail.ouvrir.l.indispo': "Ouvrir l'indispo",
  'CraDetail.fermer': 'Fermer',
}

const en: Messages = {
  'common.loading': 'Loading…',
  'common.refresh': 'Refresh',
  'common.reload': 'Reload',
  'common.close': 'Close',
  'common.previous': 'Previous',
  'common.next': 'Next',
  'common.page': 'Page',
  'common.item': 'item',
  'common.items': 'items',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.required': 'Required',
  'common.noElements': 'No items',
  'common.noData': 'No data to display.',

  'dialog.ok': 'OK',
  'dialog.confirm': 'Confirm',
  'dialog.confirmTitle': 'Confirmation',
  'dialog.infoTitle': 'Information',
  'dialog.successTitle': 'Success',
  'dialog.warningTitle': 'Warning',
  'dialog.errorTitle': 'Error',
  'dialog.input': 'Your answer',

  'app.logout': 'Sign out',
  'app.profile': 'Profile',
  'app.viewProfile': 'View my profile',
  'app.dashboard': 'Dashboard',
  'app.language': 'Language',
  'app.selectLanguage': 'Change language',

  'nav.group.management': 'Management',
  'nav.group.activity': 'Activity',
  'nav.group.finance': 'Finance',
  'nav.group.space': 'Workspace',
  'nav.group.socs': 'Companies',
  'nav.group.admin': 'Administration',

  'nav.dashboard': 'Dashboard',
  'nav.clients': 'Clients',
  'nav.suppliers': 'Suppliers',
  'nav.projects': 'Projects',
  'nav.activityTypes': 'Activity types',
  'nav.activities': 'Activities & rates',
  'nav.consultants': 'Employees',
  'nav.missions': 'Assignments',
  'nav.myActivities': 'My activities',
  'nav.cra': 'Timesheets',
  'nav.unavailability': 'Time off',
  'nav.expenses': 'Expense reports',
  'nav.holidays': 'Public holidays',
  'nav.billing': 'Invoicing',
  'nav.payslips': 'Payslips',
  'nav.documents': 'Documents',
  'nav.messages': 'Messages',
  'nav.support': 'Support',
  'nav.settings': 'Settings',
  'nav.demoSoc': 'Demo company',
  'nav.mySocs': 'My companies',
  'nav.allSocs': 'All companies',
  'nav.tables': 'Database',
  'nav.logs': 'Server logs',
  'nav.languages': 'Languages',

  'login.subtitle': 'Sign in to your workspace',
  'login.username': 'Email or username',
  'login.usernamePlaceholder': 'email or username',
  'login.password': 'Password',
  'login.showPassword': 'Show password',
  'login.forgot': 'Forgot your password?',
  'login.submit': 'Sign in',
  'login.noAccount': 'Your company does not have an account yet?',
  'login.register': 'Register my company',

  'settings.title': 'Settings',
  'settings.subtitle': 'Customize the application',
  'settings.language.title': 'Application language',
  'settings.language.description':
    'Choose the interface language. Defaults to your browser language.',
  'settings.language.field': 'Language',
  'settings.language.browser': 'Browser language',
  'settings.language.saved': 'Language updated.',
  'settings.fontSize.title': 'Application font size',
  'settings.fontSize.description':
    'Choose the text size used across the whole application (11 to 24 px).',
  'settings.fontSize.field': 'Size (px)',
  'settings.fontSize.preview': 'Preview: this is a sample text at this size.',
  'settings.theme.title': 'Application theme',
  'settings.theme.description':
    'Choose the main colour of the application among the 10 available themes.',
  'settings.theme.field': 'Theme',
  'settings.theme.preview': 'Preview: this is a sample text using the theme colours.',
  'settings.pageSize.title': 'Rows per page',
  'settings.pageSize.description':
    'Number of rows displayed per table; the rest is reachable via the Previous / Next buttons.',
  'settings.pageSize.field': 'Rows per page',
  'settings.colors.title': 'Table colours',
  'settings.colors.description':
    'Customize the header colour and the border of the application tables.',
  'settings.colors.header': 'Header colour',
  'settings.colors.border': 'Border colour',
  'settings.buttons.title': 'Buttons',
  'settings.buttons.description':
    'Customize the width and colours of the application buttons.',
  'settings.buttons.smallWidth': 'Short text width (px)',
  'settings.buttons.largeWidth': 'Long text width (px)',
  'settings.buttons.saveColor': 'Save button colour',
  'settings.buttons.deleteColor': 'Delete button colour',
  'settings.buttons.preview': 'Preview',
  'settings.background.title': 'Application background',
  'settings.background.description':
    'Gradient colour of all page backgrounds.',
  'settings.background.color': 'Background colour',
  'settings.background.preview': 'Background preview',
  'settings.saved': 'Preferences saved.',
  'settings.preview': 'Preview',
  'settings.example': 'Sample',
  'settings.row': 'Row',
  'settings.content': 'Content',
  'languages.searchRows': 'Search a row',
  'languages.searchPlaceholder': 'key or value…',
  'CraDetail.declarer.une.absence': 'Declare an absence',
  'CraDetail.absences.declarees': 'Declared absences',
  'CraDetail.absence.info':
    'The absence is submitted to the manager together with the timesheet. The timesheet can only be approved after the absence is approved.',
  'CraDetail.aucune.absence.declaree': 'No absence declared.',
  'CraDetail.valider.l.absence': 'Approve the absence',
  'CraDetail.rejeter.l.absence': 'Reject the absence',
  'CraDetail.le.type.d.absence.est.obligatoire': 'The absence type is required',
  'CraDetail.les.dates.sont.obligatoires': 'Start and end dates are required',
  'CraDetail.indispos.a.valider': 'Unavailabilities to approve',
  'CraDetail.indispos.a.valider.info':
    'The timesheet cannot be approved until these unavailabilities are approved.',
  'CraDetail.indispo.date.debut': 'Start date',
  'CraDetail.indispo.date.fin': 'End date',
  'CraDetail.ouvrir.l.indispo': 'Open the unavailability',
  'CraDetail.fermer': 'Close',
}

const ar: Messages = {
  'languages.searchRows': 'بحث عن صف',
  'languages.searchPlaceholder': 'مفتاح أو قيمة…',
  'CraDetail.declarer.une.absence': 'الإعلان عن غياب',
  'CraDetail.absences.declarees': 'الغيابات المعلنة',
  'CraDetail.absence.info':
    'يُرسل الغياب إلى المدير مع الجدول الزمني. لا يمكن اعتماد الجدول الزمني إلا بعد اعتماد الغياب.',
  'CraDetail.aucune.absence.declaree': 'لا يوجد غياب معلن.',
  'CraDetail.valider.l.absence': 'اعتماد الغياب',
  'CraDetail.rejeter.l.absence': 'رفض الغياب',
  'CraDetail.le.type.d.absence.est.obligatoire': 'نوع الغياب مطلوب',
  'CraDetail.les.dates.sont.obligatoires': 'تاريخا البداية والنهاية مطلوبان',
  'CraDetail.indispos.a.valider': 'الغيابات المطلوب اعتمادها',
  'CraDetail.indispos.a.valider.info':
    'لا يمكن اعتماد الجدول الزمني قبل اعتماد هذه الغيابات.',
  'CraDetail.indispo.date.debut': 'تاريخ البداية',
  'CraDetail.indispo.date.fin': 'تاريخ النهاية',
  'CraDetail.ouvrir.l.indispo': 'فتح الغياب',
  'CraDetail.fermer': 'إغلاق',
}

export const MESSAGES: Record<string, Messages> = {
  fr: { ...fr, ...EXTRACTED_FR },
  en: { ...en, ...EXTRACTED_EN },
  ar: { ...ar, ...EXTRACTED_AR },
}
