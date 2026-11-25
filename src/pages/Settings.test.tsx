import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Settings } from './Settings'

const { getByIdMock, findAllMock, updateCraColorsMock, updateVatRateMock, updateTableColorsMock, updateTableHeaderFontSizeMock, updateFormSettingsMock, refreshMeMock, uploadLogoMock, appearanceEffectiveMock, appearanceSaveMock, appearanceResetMock, appearanceRestoreMock, userMock } = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  findAllMock: vi.fn().mockResolvedValue([]),
  updateCraColorsMock: vi.fn(),
  updateVatRateMock: vi.fn(),
  updateTableColorsMock: vi.fn(),
  updateTableHeaderFontSizeMock: vi.fn(),
  updateFormSettingsMock: vi.fn(),
  refreshMeMock: vi.fn(),
  uploadLogoMock: vi.fn(),
  appearanceEffectiveMock: vi.fn().mockResolvedValue({ config: {}, sources: {}, userDefined: false, socDefined: false }),
  appearanceSaveMock: vi.fn().mockResolvedValue({ scope: 'SOC', scopeId: 5, config: {}, defined: true }),
  appearanceResetMock: vi.fn().mockResolvedValue(undefined),
  appearanceRestoreMock: vi.fn().mockResolvedValue({ config: {}, sources: {}, userDefined: false, socDefined: false }),
  userMock: { value: null as unknown },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: userMock.value,
    initializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    refreshMe: refreshMeMock,
  }),
}))

vi.mock('../soc/SocContext', () => ({
  useSoc: () => ({
    selectedSocId: 5,
    selectedSoc: { id: 5, name: 'Soc Test' },
    socs: [],
    favoriteSocId: 5,
    favoriteSoc: null,
    loading: false,
    refreshSocs: vi.fn(),
    selectSoc: vi.fn(),
    setFavoriteSoc: vi.fn(),
    addSoc: vi.fn(),
    canAddSoc: true,
  }),
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    preference: null,
    languages: ['fr'],
    setLanguage: vi.fn(),
    language: 'fr',
    refresh: vi.fn(),
  }),
}))

vi.mock('../api/socs', () => ({
  socsApi: {
    findAll: findAllMock,
    getById: getByIdMock,
    updateCraColors: updateCraColorsMock,
    updateVatRate: updateVatRateMock,
    uploadLogo: uploadLogoMock,
  },
}))

vi.mock('../api/emailTemplates', () => ({
  emailTemplatesApi: {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    reset: vi.fn(),
  },
}))

vi.mock('../api/i18n', () => ({
  i18nApi: {
    companyEntries: vi.fn().mockResolvedValue([]),
    saveCompanyOverride: vi.fn(),
    deleteCompanyOverride: vi.fn(),
  },
}))

vi.mock('../api/auth', () => ({
  authApi: {
    updateTableColors: updateTableColorsMock,
    updateTableHeaderFontSize: updateTableHeaderFontSizeMock,
    updateFormSettings: updateFormSettingsMock,
    updateFontSize: vi.fn(),
    updateTheme: vi.fn(),
    updatePageSize: vi.fn(),
    updateButtonSettings: vi.fn(),
    updateBackgroundColor: vi.fn(),
  },
}))

vi.mock('../api/appearance', () => ({
  appearanceApi: {
    effective: appearanceEffectiveMock,
    get: vi.fn().mockResolvedValue({ scope: 'SOC', scopeId: 5, config: {}, defined: false }),
    save: appearanceSaveMock,
    reset: appearanceResetMock,
    restore: appearanceRestoreMock,
  },
}))

vi.mock('../components/dialog', () => ({
  dialog: {
    confirm: vi.fn().mockResolvedValue(true),
    alert: vi.fn(),
  },
}))

function user(role: string) {
  return {
    id: 1,
    username: 'user',
    email: 'user@soc.fr',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    role,
    active: true,
    socId: 5,
    socName: 'Soc Test',
  }
}

afterEach(() => {
  vi.clearAllMocks()
  userMock.value = null
})

describe('Settings — couleurs CRA', () => {
  it('charge et enregistre les couleurs pour un responsable de société', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })
    updateCraColorsMock.mockResolvedValue({})

    render(<Settings />)

    fireEvent.click(document.getElementById('settings.tab.company') as HTMLElement)
    const title = await screen.findByText('settings.craColors.title')
    expect(title).toBeInTheDocument()
    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith(5))

    const leaveInput = title.parentElement
      ?.querySelector('#settings\\.craColors\\.leave')
      ?.parentElement?.querySelector('input[type="color"]') as HTMLInputElement
    const weekendInput = title.parentElement
      ?.querySelector('#settings\\.craColors\\.weekend')
      ?.parentElement?.querySelector('input[type="color"]') as HTMLInputElement
    expect(leaveInput.value).toBe('#ffeeaa')
    expect(weekendInput.value).toBe('#eefcee')

    fireEvent.change(leaveInput, { target: { value: '#ff0000' } })
    const saveButtons = screen.getAllByRole('button', { name: 'common.save' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() =>
      expect(updateCraColorsMock).toHaveBeenCalledWith(5, {
        leaveDayColor: '#ff0000',
        weekendColor: '#eefcee',
      }),
    )
  })

  it('charge et enregistre la TVA par défaut de la société', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee', vatRate: 5.5 },
      subscriptions: [],
      payments: [],
    })
    updateVatRateMock.mockResolvedValue({})

    render(<Settings />)

    fireEvent.click(document.getElementById('settings.tab.company') as HTMLElement)
    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith(5))
    const input = document.getElementById('settings.billing.vatRate.input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('5.5')

    fireEvent.change(input, { target: { value: '8.5' } })
    const saveButtons = screen.getAllByRole('button', { name: 'common.save' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() => expect(updateVatRateMock).toHaveBeenCalledWith(5, 8.5))
  })

  it('refuse une TVA hors bornes', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee', vatRate: 20 },
      subscriptions: [],
      payments: [],
    })

    render(<Settings />)

    fireEvent.click(document.getElementById('settings.tab.company') as HTMLElement)
    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith(5))
    const input = document.getElementById('settings.billing.vatRate.input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '101' } })
    const saveButtons = screen.getAllByRole('button', { name: 'common.save' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() =>
      expect(document.getElementById('settings.error')?.textContent).toContain(
        'settings.billing.vatRateError',
      ),
    )
    expect(updateVatRateMock).not.toHaveBeenCalled()
  })

  it('active le bouton Enregistrer après l’import d’un logo', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })
    uploadLogoMock.mockResolvedValue({ id: 5, name: 'Soc Test', hasLogo: true })

    render(<Settings />)

    fireEvent.click(document.getElementById('settings.tab.company') as HTMLElement)
    await waitFor(() => expect(document.getElementById('SocLogo.fieldset')).not.toBeNull())
    const saveButton = document.getElementById('common.save.button') as HTMLButtonElement
    expect(saveButton).toBeDisabled()

    const input = document.getElementById('SocLogo.choisir.input') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] },
    })

    await waitFor(() => expect(uploadLogoMock).toHaveBeenCalledWith(5, expect.any(File)))
    await waitFor(() => expect(saveButton).not.toBeDisabled())
  })

  it('affiche l’onglet Société à l’administrateur et permet de choisir la société', async () => {
    userMock.value = user('ADMIN')
    findAllMock.mockResolvedValue([
      { id: 5, name: 'Soc Test' },
      { id: 9, name: 'Autre Société' },
    ])
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })

    render(<Settings />)

    const tab = document.getElementById('settings.tab.company')
    expect(tab).not.toBeNull()
    fireEvent.click(tab as HTMLElement)

    await waitFor(() => expect(findAllMock).toHaveBeenCalled())
    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith(5))
    const select = document.getElementById('settings.company.select.input') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.value).toBe('5')

    getByIdMock.mockResolvedValue({
      soc: { id: 9, name: 'Autre Société', leaveDayColor: '#000000', weekendColor: '#ffffff', vatRate: 10 },
      subscriptions: [],
      payments: [],
    })
    fireEvent.change(select, { target: { value: '9' } })
    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith(9))
  })

  it('ne montre pas les couleurs CRA à un consultant', async () => {
    userMock.value = user('CONSULTANT')

    render(<Settings />)

    expect(screen.queryByText('settings.craColors.title')).not.toBeInTheDocument()
    expect(document.getElementById('settings.tab.company')).toBeNull()
    expect(document.getElementById('settings.tab.translations')).toBeNull()
    expect(document.getElementById('settings.tab.emails')).toBeNull()
    expect(getByIdMock).not.toHaveBeenCalled()
  })

  it('enregistre la taille de police des en-têtes de tableau', async () => {
    userMock.value = { ...user('RESPONSIBLE_SOC'), tableHeaderFontSize: 15 }
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })
    updateTableHeaderFontSizeMock.mockResolvedValue({})

    render(<Settings />)

    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    fireEvent.click(document.getElementById('settings.appearance.tab.tables') as HTMLElement)
    await screen.findByText('settings.tableHeaderFontSize.title')
    const select = document.getElementById('settings.tableHeaderFontSize.select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '24' } })
    const saveButtons = screen.getAllByRole('button', { name: 'common.save' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() =>
      expect(appearanceSaveMock).toHaveBeenCalledWith(
        'SOC',
        expect.objectContaining({ tableHeaderFontSize: '24' }),
      ),
    )
  })

  it('enregistre la couleur du texte des en-têtes de tableau', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })
    updateTableColorsMock.mockResolvedValue({})

    render(<Settings />)

    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    fireEvent.click(document.getElementById('settings.appearance.tab.tables') as HTMLElement)
    await screen.findByText('settings.colors.headerText')
    const input = document.getElementById('settings.colors.headerText.input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '#000000' } })
    const saveButtons = screen.getAllByRole('button', { name: 'common.save' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() =>
      expect(appearanceSaveMock).toHaveBeenCalledWith(
        'SOC',
        expect.objectContaining({
          tableHeaderColor: '#1d48eb',
          tableHeaderTextColor: '#000000',
          tableBorderColor: '#000000',
        }),
      ),
    )
  })

  it('enregistre les paramètres d’apparence des formulaires', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })
    updateFormSettingsMock.mockResolvedValue({})

    render(<Settings />)

    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    fireEvent.click(document.getElementById('settings.appearance.tab.forms') as HTMLElement)
    await screen.findByText('settings.forms.title')
    const bg = document.getElementById('settings.forms.headerBg.input') as HTMLInputElement
    fireEvent.change(bg, { target: { value: '#0284c7' } })
    const saveButtons = screen.getAllByRole('button', { name: 'common.save' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() =>
      expect(appearanceSaveMock).toHaveBeenCalledWith(
        'SOC',
        expect.objectContaining({
          formHeaderBackgroundColor: '#0284c7',
          formHeaderTextColor: '#ffffff',
          formHeaderFontSize: '15',
          formLabelTextColor: '#0ea5e9',
          formLabelFontSize: '12',
        }),
      ),
    )
  })

  it('restaure le paramétrage SOC360 au niveau société après confirmation', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })

    render(<Settings />)
    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    await waitFor(() =>
      expect(document.getElementById('settings.appearance.restore')).not.toBeNull(),
    )
    fireEvent.click(document.getElementById('settings.appearance.restore') as HTMLElement)

    await waitFor(() => expect(appearanceRestoreMock).toHaveBeenCalled())
  })

  it('restaure et affiche les paramètres de la société pour un manager', async () => {
    userMock.value = user('MANAGER')
    appearanceRestoreMock.mockResolvedValueOnce({
      config: { fontSize: '20', theme: 'forest', backgroundColor: '#123456' },
      sources: { fontSize: 'SOC', theme: 'SOC', backgroundColor: 'SOC' },
      userDefined: false,
      socDefined: true,
    })

    render(<Settings />)
    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    await waitFor(() =>
      expect(document.getElementById('settings.appearance.restore')).not.toBeNull(),
    )
    fireEvent.click(document.getElementById('settings.appearance.restore') as HTMLElement)

    await waitFor(() => expect(appearanceRestoreMock).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        (document.getElementById('settings.theme.field.select') as HTMLSelectElement).value,
      ).toBe('forest'),
    )
    expect(
      (document.getElementById('settings.fontSize.field.select') as HTMLSelectElement).value,
    ).toBe('20')
  })

  it('ne montre pas le bouton Restaurer à un administrateur', async () => {
    userMock.value = user('ADMIN')

    render(<Settings />)
    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    await waitFor(() =>
      expect(document.getElementById('common.save.button')).not.toBeNull(),
    )
    expect(document.getElementById('settings.appearance.restore')).toBeNull()
  })

  it('enregistre l’apparence au niveau SOC360 (GLOBAL) pour un admin', async () => {
    userMock.value = user('ADMIN')
    appearanceSaveMock.mockResolvedValue({
      scope: 'GLOBAL',
      scopeId: 0,
      config: {},
      defined: true,
    })

    render(<Settings />)
    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    fireEvent.change(document.getElementById('settings.theme.field.select') as HTMLSelectElement, {
      target: { value: 'forest' },
    })
    fireEvent.click(document.getElementById('common.save.button') as HTMLButtonElement)

    await waitFor(() =>
      expect(appearanceSaveMock).toHaveBeenCalledWith(
        'GLOBAL',
        expect.objectContaining({ theme: 'forest' }),
      ),
    )
  })

  it('enregistre l’apparence d’un manager au niveau personnel (USER)', async () => {
    userMock.value = user('MANAGER')

    render(<Settings />)
    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    const theme = document.getElementById('settings.theme.field.select') as HTMLSelectElement
    fireEvent.change(theme, { target: { value: 'forest' } })
    fireEvent.click(document.getElementById('common.save.button') as HTMLButtonElement)

    await waitFor(() =>
      expect(appearanceSaveMock).toHaveBeenCalledWith(
        'USER',
        expect.objectContaining({ theme: 'forest' }),
      ),
    )
  })

  it('active le bouton Enregistrer dès qu’un paramètre change', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })

    render(<Settings />)
    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    const save = document.getElementById('common.save.button') as HTMLButtonElement
    expect(save).toBeDisabled()

    fireEvent.change(document.getElementById('settings.theme.field.select') as HTMLSelectElement, {
      target: { value: 'forest' },
    })

    await waitFor(() => expect(save).not.toBeDisabled())
  })

  it('une seule sélection suffit pour le nombre de lignes par page', async () => {
    userMock.value = user('RESPONSIBLE_SOC')
    getByIdMock.mockResolvedValue({
      soc: { id: 5, name: 'Soc Test', leaveDayColor: '#ffeeaa', weekendColor: '#eefcee' },
      subscriptions: [],
      payments: [],
    })
    let resolveEffective: (value: unknown) => void = () => {}
    appearanceEffectiveMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEffective = resolve
        }),
    )

    render(<Settings />)
    fireEvent.click(document.getElementById('settings.tab.appearance') as HTMLElement)
    fireEvent.click(document.getElementById('settings.appearance.tab.tables') as HTMLElement)
    const select = document.getElementById('settings.pageSize.field.select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '10' } })
    expect(select.value).toBe('10')

    // Le chargement de l'apparence effective arrive après la saisie : il ne doit pas l'écraser.
    resolveEffective({ config: {}, sources: {}, userDefined: false, socDefined: false })
    await waitFor(() => expect(select.value).toBe('10'))
  })
})
