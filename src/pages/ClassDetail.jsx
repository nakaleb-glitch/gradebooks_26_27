import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizeLinkUrl, uploadTeacherAnnouncementPdf } from '../lib/announcementAttachments'
import { uploadWeeklyMaterialFile, WEEKLY_MATERIALS_BUCKET, isUuid } from '../lib/weeklyMaterials'
import AnnouncementPdfButton from '../components/AnnouncementPdfButton'
import WeeklyMaterialFileButton from '../components/WeeklyMaterialFileButton'
import Layout from '../components/Layout'
import ProfileAvatar from '../components/ProfileAvatar'
import { useAuth } from '../contexts/AuthContext'
import { getCurrentWeekIndexWithOverride } from '../lib/academicCalendar'

const TERMS = [
  { key: 'midterm_1', label: 'Midterm 1', weeks: 8 },
  { key: 'final_1', label: 'Final 1', weeks: 8 },
  { key: 'midterm_2', label: 'Midterm 2', weeks: 12 },
  { key: 'final_2', label: 'Final 2', weeks: 12 },
]

const PARTICIPATION_WEEK_SCHEDULE = {
  midterm_1: [
    { week: 0, label: 'Orientation', range: 'Aug. 17 - Aug. 21' },
    { week: 1, label: 'Week 1', range: 'Aug. 24 - Aug. 28' },
    { week: 2, label: 'Week 2', range: 'Aug. 31 - Sep. 5' },
    { week: 3, label: 'Week 3', range: 'Sep. 7 - Sep. 11' },
    { week: 4, label: 'Week 4', range: 'Sep. 14 - Sep. 18' },
    { week: 5, label: 'Week 5', range: 'Sep. 21 - Sep. 25' },
    { week: 6, label: 'Week 6', range: 'Sep. 28 - Oct. 2' },
    { week: 7, label: 'Week 7', range: 'Oct. 5 - Oct. 9', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_1: [
    { week: 8, label: 'Week 8', range: 'Oct. 12 - Oct. 16' },
    { week: 9, label: 'Week 9', range: 'Oct. 19 - Oct. 23' },
    { week: 10, label: 'Week 10', range: 'Oct. 26 - Oct. 31' },
    { week: 11, label: 'Week 11', range: 'Nov. 2 - Nov. 6' },
    { week: 12, label: 'Week 12', range: 'Nov. 9 - Nov. 13' },
    { week: 13, label: 'Week 13', range: 'Nov. 16 - Nov. 20' },
    { week: 14, label: 'Week 14', range: 'Nov. 23 - Nov. 27' },
    { week: 15, label: 'Week 15', range: 'Nov. 30 - Dec. 4', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  midterm_2: [
    { week: 16, label: 'Week 16', range: 'Dec. 7 - Dec. 11' },
    { week: 17, label: 'Week 17', range: 'Dec. 14 - Dec. 18' },
    { week: 18, label: 'Week 18', range: 'Dec. 21 - Dec. 25', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 19, label: 'Week 19', range: 'Dec. 28 - Jan. 1', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 20, label: 'Week 20', range: 'Jan. 4 - Jan. 8' },
    { week: 21, label: 'Week 21', range: 'Jan. 11 - Jan. 15' },
    { week: 22, label: 'Week 22', range: 'Jan. 18 - Jan. 22' },
    { week: 23, label: 'Week 23', range: 'Jan. 25 - Jan. 29' },
    { week: 24, label: 'Week 24', range: 'Feb. 1 - Feb. 5', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 25, label: 'Week 25', range: 'Feb. 8 - Feb. 12', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 26, label: 'Week 26', range: 'Feb. 15 - Feb. 19' },
    { week: 27, label: 'Week 27', range: 'Feb. 22 - Feb. 26', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_2: [
    { week: 28, label: 'Week 28', range: 'Mar. 1 - Mar. 5' },
    { week: 29, label: 'Week 29', range: 'Mar. 8 - Mar. 12' },
    { week: 30, label: 'Week 30', range: 'Mar. 15 - Mar. 19' },
    { week: 31, label: 'Week 31', range: 'Mar. 22 - Mar. 26' },
    { week: 32, label: 'Week 32', range: 'Mar. 29 - Apr. 2' },
    { week: 33, label: 'Week 33', range: 'Apr. 5 - Apr. 9' },
    { week: 34, label: 'Week 34', range: 'Apr. 12 - Apr. 16' },
    { week: 35, label: 'Week 35', range: 'Apr. 19 - Apr. 23', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 36, label: 'Week 36', range: 'Apr. 26 - Apr. 30', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 37, label: 'Week 37', range: 'May 3 - May 7', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 38, label: 'Week 38', range: 'May 10 - May 14', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 39, label: 'Week 39', range: 'May 17 - May 21', isNoScore: true, noScoreReason: 'Post Exam Week' },
  ],
}

const ALL_WEEKS = [
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_1,
  ...PARTICIPATION_WEEK_SCHEDULE.final_1,
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_2,
  ...PARTICIPATION_WEEK_SCHEDULE.final_2,
]

const getTermDateSummary = (termKey) => {
  const weeks = PARTICIPATION_WEEK_SCHEDULE[termKey] || []
  if (weeks.length === 0) return null

  const firstRange = weeks[0]?.range || ''
  const lastRange = weeks[weeks.length - 1]?.range || ''

  const firstDate = firstRange.split('-')[0]?.trim() || ''
  const lastDate = lastRange.split('-')[1]?.trim() || ''
  if (!firstDate || !lastDate || firstDate === 'Date TBD' || lastDate === 'Date TBD') return null

  return `${firstDate} - ${lastDate}`
}


export default function ClassDetail() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [cls, setCls] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [selectedTerm, setSelectedTerm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasUnsavedGradebook, setHasUnsavedGradebook] = useState(false)
  const [studentRoster, setStudentRoster] = useState([])
  const [classAnnouncements, setClassAnnouncements] = useState([])
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [announcementLinkUrl, setAnnouncementLinkUrl] = useState('')
  const [announcementPdfFile, setAnnouncementPdfFile] = useState(null)
  const announcementPdfInputRef = useRef(null)
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)
  const [announcementFeedback, setAnnouncementFeedback] = useState(null)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [showSentAnnouncements, setShowSentAnnouncements] = useState(false)
  const [activeWeek, setActiveWeek] = useState(0)
  const [selectedUploadWeek, setSelectedUploadWeek] = useState(0)
  const [weeklyMaterials, setWeeklyMaterials] = useState([])
  const [loadingWeeklyMaterials, setLoadingWeeklyMaterials] = useState(false)
  const [weeklyMaterialTitle, setWeeklyMaterialTitle] = useState('')
  const [weeklyMaterialDescription, setWeeklyMaterialDescription] = useState('')
  const [weeklyMaterialLinkUrl, setWeeklyMaterialLinkUrl] = useState('')
  const [weeklyMaterialLessonNumber, setWeeklyMaterialLessonNumber] = useState('')
  const [weeklyMaterialFile, setWeeklyMaterialFile] = useState(null)
  const weeklyMaterialFileInputRef = useRef(null)
  const [targetClassIds, setTargetClassIds] = useState([])
  const [targetClasses, setTargetClasses] = useState([])
  const [savingWeeklyMaterial, setSavingWeeklyMaterial] = useState(false)
  const [weeklyMaterialFeedback, setWeeklyMaterialFeedback] = useState(null)
  const [editingMaterialId, setEditingMaterialId] = useState(null)
  const [editingMaterialDraft, setEditingMaterialDraft] = useState({
    title: '',
    description: '',
    week: 0,
    lesson_number: '',
    external_url: '',
  })
  const [activeTab, setActiveTab] = useState('students')
  const [, setForceUpdate] = useState(0)

  const canManageWeeklyUploads = (
    profile?.role === 'admin' ||
    profile?.role === 'admin_teacher' ||
    (profile?.role === 'teacher' && profile?.id === cls?.teacher_id)
  )
  const validTargetClasses = useMemo(
    () => (targetClasses || []).filter((target) => isUuid(target.id)),
    [targetClasses]
  )
  const allowedTargetClassIds = useMemo(
    () => new Set(validTargetClasses.map((target) => target.id)),
    [validTargetClasses]
  )
  const invalidTargetClassCount = (targetClasses?.length || 0) - validTargetClasses.length

  // Listen for changes to current week from navigation bar
  useEffect(() => {
    const updateWeek = () => {
      setActiveWeek(getCurrentWeekIndexWithOverride(40))
    }

    updateWeek()
    const interval = setInterval(updateWeek, 500)
    return () => clearInterval(interval)
  }, [])

  // Always read directly from storage for latest value - no local caching
  const detectCurrentTerm = () => {
    const week = getCurrentWeekIndexWithOverride(40)

    if (week >= 0 && week <= 7) return 'midterm_1'
    if (week >= 8 && week <= 15) return 'final_1'
    if (week >= 16 && week <= 27) return 'midterm_2'
    if (week >= 28 && week <= 39) return 'final_2'
    return null
  }

  // Force re-render when returning to page to refresh the badge
  useEffect(() => {
    const onPageVisible = () => {
      // Trigger re-render to update current term badge
      setForceUpdate((x) => x + 1)
    }

    window.addEventListener('visibilitychange', onPageVisible)
    return () => window.removeEventListener('visibilitychange', onPageVisible)
  }, [])

  const fetchClass = useCallback(async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, users!classes_teacher_id_fkey(full_name, email)')
      .eq('id', classId)
      .single()

    if (error) {
      console.error('Failed to load class:', error)
    }

    // Teachers can only manage classes assigned to them.
    if (profile?.role === 'teacher' && data && data.teacher_id !== profile.id) {
      setAccessDenied(true)
      setCls(null)
      setLoading(false)
      return
    }

    setAccessDenied(false)
    setCls(data)
    setLoading(false)
  }, [classId, profile?.id, profile?.role])

  const fetchStudentRoster = useCallback(async () => {
    const { data } = await supabase
      .from('class_students')
      .select(`
        students(id, student_id, name_eng, name_vn, avatar_url)
      `)
      .eq('class_id', classId)

    const list = (data || [])
      .map(row => row.students)
      .filter(Boolean)
      .sort((a, b) => (a.name_eng || '').localeCompare(b.name_eng || '', undefined, { numeric: true }))

    setStudentRoster(list)
  }, [classId])

  const fetchClassAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('teacher_announcement_targets')
      .select('announcement_id, teacher_announcements(id, title, message, created_at, link_url, attachment_url, attachment_name)')
      .eq('class_id', classId)

    const rows = (data || [])
      .map((row) => row.teacher_announcements)
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setClassAnnouncements(rows)
  }, [classId])

  const fetchTargetClasses = useCallback(async () => {
    if (!profile?.id) return
    let query = supabase
      .from('classes')
      .select('id, name, subject, programme')
      .order('name')

    if (profile.role === 'teacher' || profile.role === 'admin_teacher') {
      query = query.eq('teacher_id', profile.id)
    }

    const { data, error } = await query
    if (error) {
      console.error('Failed to load target classes:', error)
      setTargetClasses([])
      return
    }
    setTargetClasses(data || [])
  }, [profile?.id, profile?.role])

  const fetchWeeklyMaterials = useCallback(async () => {
    if (!classId) return
    setLoadingWeeklyMaterials(true)
    const { data, error } = await supabase
      .from('weekly_lesson_materials')
      .select('*')
      .eq('class_id', classId)
      .eq('week', selectedUploadWeek)
      .order('lesson_number', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load weekly materials:', error)
      setWeeklyMaterials([])
      setLoadingWeeklyMaterials(false)
      return
    }

    setWeeklyMaterials(data || [])
    setLoadingWeeklyMaterials(false)
  }, [classId, selectedUploadWeek])

  useEffect(() => {
    fetchClass()
  }, [fetchClass])
  useEffect(() => {
    fetchStudentRoster()
  }, [fetchStudentRoster])
  useEffect(() => {
    fetchClassAnnouncements()
  }, [fetchClassAnnouncements])
  useEffect(() => {
    if (canManageWeeklyUploads) fetchTargetClasses()
  }, [canManageWeeklyUploads, fetchTargetClasses])
  useEffect(() => {
    if (activeTab === 'uploads') {
      fetchWeeklyMaterials()
    }
  }, [activeTab, fetchWeeklyMaterials])
  useEffect(() => {
    if (!selectedTerm) setHasUnsavedGradebook(false)
  }, [selectedTerm])
  useEffect(() => {
    if (selectedTerm) setSelectedAnnouncement(null)
  }, [selectedTerm])
  useEffect(() => {
    // Refresh current term detection when activeWeek updates
    setForceUpdate((x) => x + 1)
  }, [activeWeek])
  useEffect(() => {
    setSelectedUploadWeek(activeWeek)
  }, [activeWeek])
  useEffect(() => {
    if (!classId || !isUuid(classId)) return
    setTargetClassIds((prev) => (prev.length > 0 ? prev : [classId]))
  }, [classId])
  useEffect(() => {
    setTargetClassIds((prev) => prev.filter((id) => isUuid(id)))
  }, [targetClasses])

  const handlePostClassAnnouncement = async () => {
    setAnnouncementFeedback(null)

    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setAnnouncementFeedback({ type: 'error', text: 'Please enter both title and message.' })
      return
    }

    setPostingAnnouncement(true)
    const linkUrl = normalizeLinkUrl(announcementLinkUrl)

    const { data: announcement, error: announcementError } = await supabase
      .from('teacher_announcements')
      .insert({
        teacher_id: profile.id,
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        scope: 'single_class',
        link_url: linkUrl,
      })
      .select('id')
      .single()

    if (announcementError || !announcement?.id) {
      setPostingAnnouncement(false)
      setAnnouncementFeedback({
        type: 'error',
        text: `Unable to post announcement: ${announcementError?.message || 'Unknown error'}`,
      })
      return
    }

    const { error: targetError } = await supabase
      .from('teacher_announcement_targets')
      .insert({
        announcement_id: announcement.id,
        class_id: classId,
      })

    if (targetError) {
      setPostingAnnouncement(false)
      setAnnouncementFeedback({
        type: 'error',
        text: `Announcement saved, but class targeting failed: ${targetError.message}`,
      })
      return
    }

    let showAnnouncementSuccess = true

    if (announcementPdfFile) {
      const { path, displayName, error: uploadError } = await uploadTeacherAnnouncementPdf(
        announcement.id,
        announcementPdfFile
      )
      if (uploadError || !path) {
        setPostingAnnouncement(false)
        setAnnouncementFeedback({
          type: 'error',
          text: `Announcement posted, but the PDF could not be uploaded: ${uploadError?.message || 'Unknown error'}`,
        })
        setAnnouncementTitle('')
        setAnnouncementMessage('')
        setAnnouncementLinkUrl('')
        setAnnouncementPdfFile(null)
        if (announcementPdfInputRef.current) announcementPdfInputRef.current.value = ''
        await fetchClassAnnouncements()
        return
      }
      const { error: attachError } = await supabase
        .from('teacher_announcements')
        .update({ attachment_url: path, attachment_name: displayName })
        .eq('id', announcement.id)
        .eq('teacher_id', profile.id)
      if (attachError) {
        setAnnouncementFeedback({
          type: 'error',
          text: `Announcement posted, but saving the attachment failed: ${attachError.message}`,
        })
        showAnnouncementSuccess = false
      }
    }

    setPostingAnnouncement(false)

    setAnnouncementTitle('')
    setAnnouncementMessage('')
    setAnnouncementLinkUrl('')
    setAnnouncementPdfFile(null)
    if (announcementPdfInputRef.current) announcementPdfInputRef.current.value = ''
    await fetchClassAnnouncements()

    if (showAnnouncementSuccess) {
      setAnnouncementFeedback({ type: 'success', text: 'Announcement posted to this class.' })
    }
  }

  const toggleTargetClass = (targetId) => {
    setTargetClassIds((prev) => (
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    ))
  }

  const handleSaveWeeklyMaterial = async () => {
    if (!canManageWeeklyUploads) return
    setWeeklyMaterialFeedback(null)

    const normalizedLesson = String(weeklyMaterialLessonNumber || '').trim()
    const parsedLessonNumber = normalizedLesson ? Number(normalizedLesson) : null
    if (normalizedLesson && (!Number.isInteger(parsedLessonNumber) || parsedLessonNumber <= 0)) {
      setWeeklyMaterialFeedback({ type: 'error', text: 'Lesson number must be a positive whole number.' })
      return
    }
    if (!weeklyMaterialTitle.trim()) {
      setWeeklyMaterialFeedback({ type: 'error', text: 'Please enter a material title.' })
      return
    }
    const normalizedLinkUrl = normalizeLinkUrl(weeklyMaterialLinkUrl)
    if (!normalizedLinkUrl && !weeklyMaterialFile) {
      setWeeklyMaterialFeedback({ type: 'error', text: 'Please provide a link or a file (or both).' })
      return
    }
    if (!Number.isInteger(Number(selectedUploadWeek))) {
      setWeeklyMaterialFeedback({ type: 'error', text: 'Please select a valid week.' })
      return
    }

    const validTargetClassIds = Array.from(new Set(targetClassIds.filter((id) => isUuid(id))))
    if (validTargetClassIds.length === 0) {
      setWeeklyMaterialFeedback({ type: 'error', text: 'Select at least one valid class target.' })
      return
    }
    const unauthorizedTarget = validTargetClassIds.find((id) => !allowedTargetClassIds.has(id))
    if (unauthorizedTarget) {
      setWeeklyMaterialFeedback({
        type: 'error',
        text: 'One or more selected classes are not assigned to your account.',
      })
      return
    }

    if (!weeklyMaterialFile) {
      setSavingWeeklyMaterial(true)
      const { error } = await supabase
        .from('weekly_lesson_materials')
        .insert(validTargetClassIds.map((targetClassId) => ({
          class_id: targetClassId,
          week: selectedUploadWeek,
          lesson_number: parsedLessonNumber,
          title: weeklyMaterialTitle.trim(),
          description: weeklyMaterialDescription.trim() || null,
          material_type: 'link',
          external_url: normalizedLinkUrl,
          created_by: profile.id,
          updated_by: profile.id,
        })))
      setSavingWeeklyMaterial(false)
      if (error) {
        setWeeklyMaterialFeedback({ type: 'error', text: `Unable to save material: ${error.message}` })
        return
      }
      setWeeklyMaterialTitle('')
      setWeeklyMaterialDescription('')
      setWeeklyMaterialLinkUrl('')
      setWeeklyMaterialLessonNumber('')
      setWeeklyMaterialFeedback({
        type: 'success',
        text: `Material uploaded to ${validTargetClassIds.length} class${validTargetClassIds.length > 1 ? 'es' : ''}.`,
      })
      await fetchWeeklyMaterials()
      return
    }

    setSavingWeeklyMaterial(true)
    const uploadedPaths = []
    const rowsToInsert = []
    let uploadFailure = null

    for (const targetClassId of validTargetClassIds) {
      const { path, displayName, error: uploadError } = await uploadWeeklyMaterialFile({
        classId: targetClassId,
        week: selectedUploadWeek,
        lessonNumber: parsedLessonNumber,
        file: weeklyMaterialFile,
      })
      if (uploadError || !path) {
        uploadFailure = uploadError || new Error('Unknown upload error')
        break
      }
      uploadedPaths.push(path)
      rowsToInsert.push({
        class_id: targetClassId,
        week: selectedUploadWeek,
        lesson_number: parsedLessonNumber,
        title: weeklyMaterialTitle.trim(),
        description: weeklyMaterialDescription.trim() || null,
        material_type: 'file',
        external_url: normalizedLinkUrl,
        storage_path: path,
        file_name: displayName,
        mime_type: weeklyMaterialFile?.type || null,
        file_size_bytes: weeklyMaterialFile?.size || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
    }

    if (uploadFailure) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(WEEKLY_MATERIALS_BUCKET).remove(uploadedPaths)
      }
      setSavingWeeklyMaterial(false)
      setWeeklyMaterialFeedback({
        type: 'error',
        text: `Unable to upload file: ${uploadFailure.message || 'Unknown error'}`,
      })
      return
    }

    const { error: insertError } = await supabase
      .from('weekly_lesson_materials')
      .insert(rowsToInsert)

    if (insertError) {
      await supabase.storage.from(WEEKLY_MATERIALS_BUCKET).remove(uploadedPaths)
      setSavingWeeklyMaterial(false)
      setWeeklyMaterialFeedback({ type: 'error', text: `File uploaded, but saving failed: ${insertError.message}` })
      return
    }

    setSavingWeeklyMaterial(false)
    setWeeklyMaterialTitle('')
    setWeeklyMaterialDescription('')
    setWeeklyMaterialLinkUrl('')
    setWeeklyMaterialLessonNumber('')
    setWeeklyMaterialFile(null)
    if (weeklyMaterialFileInputRef.current) weeklyMaterialFileInputRef.current.value = ''
    setWeeklyMaterialFeedback({
      type: 'success',
      text: `Weekly file uploaded to ${validTargetClassIds.length} class${validTargetClassIds.length > 1 ? 'es' : ''}.`,
    })
    await fetchWeeklyMaterials()
  }

  const handleDeleteWeeklyMaterial = async (item) => {
    if (!canManageWeeklyUploads) return
    const confirmDelete = window.confirm('Delete this weekly material?')
    if (!confirmDelete) return

    if (item.storage_path) {
      await supabase.storage.from(WEEKLY_MATERIALS_BUCKET).remove([item.storage_path])
    }
    const { error } = await supabase
      .from('weekly_lesson_materials')
      .delete()
      .eq('id', item.id)

    if (error) {
      window.alert(`Unable to delete material: ${error.message}`)
      return
    }
    await fetchWeeklyMaterials()
  }

  const startEditWeeklyMaterial = (item) => {
    setEditingMaterialId(item.id)
    setEditingMaterialDraft({
      title: item.title || '',
      description: item.description || '',
      week: item.week,
      lesson_number: item.lesson_number || '',
      external_url: item.external_url || '',
    })
  }

  const cancelEditWeeklyMaterial = () => {
    setEditingMaterialId(null)
    setEditingMaterialDraft({ title: '', description: '', week: selectedUploadWeek, lesson_number: '', external_url: '' })
  }

  const saveEditWeeklyMaterial = async (item) => {
    if (!canManageWeeklyUploads) return
    const parsedWeek = Number(editingMaterialDraft.week)
    const lessonText = String(editingMaterialDraft.lesson_number || '').trim()
    const parsedLesson = lessonText ? Number(lessonText) : null
    if (!Number.isInteger(parsedWeek) || parsedWeek < 0 || parsedWeek > 39) {
      window.alert('Please choose a valid week.')
      return
    }
    if (lessonText && (!Number.isInteger(parsedLesson) || parsedLesson <= 0)) {
      window.alert('Lesson number must be a positive whole number.')
      return
    }
    if (!editingMaterialDraft.title.trim()) {
      window.alert('Material title is required.')
      return
    }

    const payload = {
      title: editingMaterialDraft.title.trim(),
      description: editingMaterialDraft.description?.trim() || null,
      week: parsedWeek,
      lesson_number: parsedLesson,
      updated_by: profile.id,
    }
    if (editingMaterialDraft.external_url && editingMaterialDraft.external_url.trim()) {
      const normalized = normalizeLinkUrl(editingMaterialDraft.external_url)
      if (!normalized) {
        window.alert('Please enter a valid link URL.')
        return
      }
      payload.external_url = normalized
    } else if (item.storage_path) {
      payload.external_url = null
    } else {
      window.alert('Please keep a valid link when no file is attached.')
      return
    }

    const { error } = await supabase
      .from('weekly_lesson_materials')
      .update(payload)
      .eq('id', item.id)

    if (error) {
      window.alert(`Unable to save changes: ${error.message}`)
      return
    }
    cancelEditWeeklyMaterial()
    await fetchWeeklyMaterials()
  }

  const handleTopTabChange = (nextTab) => {
    if (selectedTerm) {
      const hasUnsaved = hasUnsavedGradebook || sessionStorage.getItem('gradebook_unsaved_changes') === '1'
      if (hasUnsaved) {
        window.alert('You have unsaved gradebook changes. Please save or discard them before switching tabs.')
        return
      }
      setSelectedTerm(null)
      sessionStorage.setItem('gradebook_unsaved_changes', '0')
      setHasUnsavedGradebook(false)
    }
    setActiveTab(nextTab)
  }

  if (loading) return <Layout><div className="text-center text-gray-400 py-20">Loading...</div></Layout>
  if (accessDenied) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-20">You do not have access to manage this class.</div>
      </Layout>
    )
  }
  if (!cls) return <Layout><div className="text-center text-gray-400 py-20">Class not found.</div></Layout>
  const selectedTermLabel = TERMS.find(t => t.key === selectedTerm)?.label

  return (
    <Layout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => {
              const hasUnsaved = hasUnsavedGradebook || sessionStorage.getItem('gradebook_unsaved_changes') === '1'
              if (hasUnsaved) {
                const leave = window.confirm('You have unsaved gradebook changes. Please click Save before leaving this page. Continue anyway?')
                if (!leave) return
              }
              sessionStorage.setItem('gradebook_unsaved_changes', '0')
              const hasHistory = window.history.length > 1
              if (hasHistory) navigate(-1)
              else navigate(profile?.role === 'admin' ? '/admin/classes' : '/dashboard')
            }}
            className="text-sm text-white px-3 py-1.5 rounded-lg mb-4 flex items-center gap-1 transition-colors"
            style={{ backgroundColor: '#1f86c7' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#1a74ad'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#1f86c7'}
          >
            ← Go Back
          </button>
          <h2 className="text-2xl font-bold text-gray-900">{cls.name}</h2>
          <p className="text-gray-500 text-sm mt-1">
            {cls.level === 'primary' ? 'Primary' : 'Secondary'} · {cls.programme === 'bilingual' ? 'Bilingual' : 'Integrated'} · 2026-2027
          </p>
          <p className="text-xs text-gray-500 mt-1">{studentRoster.length} students</p>
        </div>
        {selectedTerm && (
          <div className="text-right mt-10">
            <div className="text-lg font-semibold text-gray-900">{selectedTermLabel}</div>
            <div className="text-sm text-gray-500">Teacher Gradebook V2</div>
            <button
              type="button"
              onClick={() => {
                const hasUnsaved = hasUnsavedGradebook || sessionStorage.getItem('gradebook_unsaved_changes') === '1'
                if (hasUnsaved) {
                  const leave = window.confirm('You have unsaved changes. Please click Save before leaving this gradebook. Continue anyway?')
                  if (!leave) return
                }
                sessionStorage.setItem('gradebook_unsaved_changes', '0')
                setHasUnsavedGradebook(false)
                setSelectedTerm(null)
              }}
              className="mt-2 text-sm text-white px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: '#1f86c7' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#1a74ad'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#1f86c7'}
            >
              ← Go Back
            </button>
          </div>
        )}
       </div>

      {/* Page Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => handleTopTabChange('students')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'students'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Student List
        </button>
        <button
          onClick={() => handleTopTabChange('gradebooks')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'gradebooks'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Gradebooks
        </button>
        <button
          onClick={() => handleTopTabChange('resources')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'resources'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Teacher Resources
        </button>
        <button
          onClick={() => handleTopTabChange('announcements')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'announcements'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Class Announcements
        </button>
        <button
          onClick={() => handleTopTabChange('uploads')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'uploads'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Weekly Uploads
        </button>
      </div>

      {!selectedTerm ? (
        <div className="space-y-6">
          {activeTab === 'students' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
              {studentRoster.length === 0 ? (
                <div className="p-6 text-sm text-gray-400">No students enrolled in this class yet.</div>
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(8 * 57px)' }}>
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[56px]" />
                      <col className="w-[100px]" />
                      <col className="w-[40%]" />
                      <col className="w-[40%]" />
                    </colgroup>
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium" aria-label="Avatar column"></th>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium">Student ID</th>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium">Student Name (VN)</th>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium">Student Name (ENG)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {studentRoster.map(student => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <ProfileAvatar 
                              avatarUrl={student.avatar_url} 
                              name={student.name_eng} 
                              size={32}
                            />
                          </td>
                          <td className="px-3 py-3 text-gray-600">{student.student_id || '—'}</td>
                          <td className="px-3 py-3 font-medium text-blue-700">
                            {student.name_vn || '—'}
                          </td>
                          <td className="px-3 py-3 font-medium text-gray-900">
                            {student.name_eng || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'gradebooks' && (
            <div className="bg-white rounded-xl border border-gray-200 p-3.5" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                <div className="grid grid-cols-2 gap-3">
                  {TERMS.map(term => {
                    const isCurrentTerm = detectCurrentTerm() === term.key
                    return (
                      <button key={term.key} onClick={() => setSelectedTerm(term.key)}
                        className={`bg-white rounded-xl border p-5 text-left hover:shadow-sm transition-all relative ${isCurrentTerm ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}
                        style={{ borderTopColor: isCurrentTerm ? '#22c55e' : '#9ca3af', borderTopWidth: 3 }}>
                        {isCurrentTerm && (
                          <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 bg-green-600 text-white rounded-full font-medium">
                            ✓ Current Term
                          </span>
                        )}
                        <div className="text-lg font-semibold text-gray-900">{term.label}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          {term.weeks} weeks
                          {getTermDateSummary(term.key) ? ` · ${getTermDateSummary(term.key)}` : ''}
                        </div>
                      </button>
                    )
                  })}
                </div>
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="bg-white rounded-xl border border-gray-200 p-3.5" style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}>
                <ResourceCards
                  level={cls.level}
                  grade={String(cls.name || '').trim().match(/^(\d+)/)?.[1] || null}
                  programme={cls.programme}
                  subject={cls.subject}
                />
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="bg-white rounded-xl border border-gray-200 p-3.5" style={{ borderTopColor: '#22c55e', borderTopWidth: 3 }}>
                {profile?.role === 'teacher' && profile?.id === cls.teacher_id && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {showAnnouncementForm ? 'Cancel' : 'Create New Announcement'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSentAnnouncements(!showSentAnnouncements)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {showSentAnnouncements ? 'Hide Announcements' : 'View Announcements'}
                      </button>
                    </div>
                    
                    {showAnnouncementForm && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label htmlFor="class-announcement-title" className="block text-xs font-medium text-gray-500 mb-1">
                            Title
                          </label>
                          <input
                            id="class-announcement-title"
                            type="text"
                            value={announcementTitle}
                            onChange={(e) => setAnnouncementTitle(e.target.value)}
                            placeholder="Short headline"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="class-announcement-message" className="block text-xs font-medium text-gray-500 mb-1">
                            Message
                          </label>
                          <textarea
                            id="class-announcement-message"
                            value={announcementMessage}
                            onChange={(e) => setAnnouncementMessage(e.target.value)}
                            placeholder="Write your class announcement..."
                            className="w-full min-h-[8rem] max-h-[min(24rem,50vh)] rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
                          />
                        </div>
                        <div>
                          <label htmlFor="class-announcement-link" className="block text-xs font-medium text-gray-500 mb-1">
                            Link (optional)
                          </label>
                          <input
                            id="class-announcement-link"
                            type="text"
                            inputMode="url"
                            autoComplete="url"
                            value={announcementLinkUrl}
                            onChange={(e) => setAnnouncementLinkUrl(e.target.value)}
                            placeholder="e.g. Google Drive or class resource"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="class-announcement-pdf" className="block text-xs font-medium text-gray-500 mb-1">
                            PDF attachment (optional)
                          </label>
                          <input
                            id="class-announcement-pdf"
                            ref={announcementPdfInputRef}
                            type="file"
                            accept="application/pdf"
                            className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-sm"
                            onChange={(e) => setAnnouncementPdfFile(e.target.files?.[0] || null)}
                          />
                          {announcementPdfFile && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-full" title={announcementPdfFile.name}>
                              {announcementPdfFile.name}
                            </div>
                          )}
                        </div>
                        {announcementFeedback && (
                          <div
                            className={`text-xs px-2 py-1 rounded border ${
                              announcementFeedback.type === 'success'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {announcementFeedback.text}
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handlePostClassAnnouncement}
                            disabled={postingAnnouncement}
                            className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                          >
                            {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                          </button>
                        </div>
                      </div>
                    )}

                    {showSentAnnouncements && (
                      <div className="mt-3 border-t border-gray-200 pt-3 space-y-2 max-h-48 overflow-y-auto">
                        {classAnnouncements.length === 0 ? (
                          <div className="text-xs text-gray-500">No announcements posted yet.</div>
                        ) : (
                          classAnnouncements.slice(0, 8).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedAnnouncement(item)}
                              className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-green-50 transition-colors"
                            >
                              <div className="text-sm font-medium text-gray-800">{item.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
                {profile?.role === 'admin' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {classAnnouncements.length === 0 ? (
                      <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        No announcements posted for this class yet.
                      </div>
                    ) : (
                      classAnnouncements.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedAnnouncement(item)}
                          className="text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-green-300 hover:bg-green-50/40 transition-colors"
                        >
                          <div className="text-sm font-semibold text-gray-900 line-clamp-2">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(item.created_at).toLocaleDateString('en-GB')}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
            </div>
          )}

          {activeTab === 'uploads' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4" style={{ borderTopColor: '#6366f1', borderTopWidth: 3 }}>
              <div className="flex items-center gap-3">
                <label htmlFor="weekly-upload-week" className="text-sm font-medium text-gray-700">Week</label>
                <select
                  id="weekly-upload-week"
                  value={selectedUploadWeek}
                  onChange={(e) => setSelectedUploadWeek(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {ALL_WEEKS.map((weekItem) => (
                    <option key={weekItem.week} value={weekItem.week}>
                      {weekItem.label} - {weekItem.range}
                    </option>
                  ))}
                </select>
              </div>

              {canManageWeeklyUploads && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3">
                  <div className="md:col-span-2">
                    <label htmlFor="weekly-material-title" className="block text-xs font-medium text-gray-500 mb-1">Material title</label>
                    <input
                      id="weekly-material-title"
                      type="text"
                      value={weeklyMaterialTitle}
                      onChange={(e) => setWeeklyMaterialTitle(e.target.value)}
                      placeholder="e.g. Week 6 Listening Slides"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="weekly-material-description" className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                    <textarea
                      id="weekly-material-description"
                      value={weeklyMaterialDescription}
                      onChange={(e) => setWeeklyMaterialDescription(e.target.value)}
                      placeholder="Short context for students..."
                      className="w-full min-h-[80px] rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
                    />
                  </div>
                  <div>
                    <label htmlFor="weekly-material-lesson" className="block text-xs font-medium text-gray-500 mb-1">Lesson # (optional)</label>
                    <input
                      id="weekly-material-lesson"
                      type="number"
                      min="1"
                      step="1"
                      value={weeklyMaterialLessonNumber}
                      onChange={(e) => setWeeklyMaterialLessonNumber(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="weekly-material-link" className="block text-xs font-medium text-gray-500 mb-1">Link (Google Slides/Canva/etc.)</label>
                    <input
                      id="weekly-material-link"
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      value={weeklyMaterialLinkUrl}
                      onChange={(e) => setWeeklyMaterialLinkUrl(e.target.value)}
                      placeholder="Paste link to material"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="weekly-material-file" className="block text-xs font-medium text-gray-500 mb-1">File (PDF/PPT/PPTX/DOC/DOCX)</label>
                    <input
                      id="weekly-material-file"
                      ref={weeklyMaterialFileInputRef}
                      type="file"
                      accept=".pdf,.ppt,.pptx,.doc,.docx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setWeeklyMaterialFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-sm"
                    />
                    {weeklyMaterialFile && (
                      <div className="text-xs text-gray-500 mt-1 truncate" title={weeklyMaterialFile.name}>
                        {weeklyMaterialFile.name}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <span className="block text-xs font-medium text-gray-500 mb-1">Post to classes</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 border border-gray-200 rounded-lg p-2 max-h-36 overflow-y-auto">
                      {validTargetClasses.length === 0 ? (
                        <div className="text-xs text-gray-400">No target classes available.</div>
                      ) : validTargetClasses.map((target) => (
                        <label key={target.id} className="text-xs text-gray-700 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={targetClassIds.includes(target.id)}
                            onChange={() => toggleTargetClass(target.id)}
                          />
                          <span>{target.name}</span>
                        </label>
                      ))}
                    </div>
                    {invalidTargetClassCount > 0 && (
                      <div className="mt-1 text-xs text-amber-700">
                        {invalidTargetClassCount} class target(s) were skipped because they do not have a valid UUID id.
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="button"
                      disabled={savingWeeklyMaterial}
                      onClick={handleSaveWeeklyMaterial}
                      className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {savingWeeklyMaterial ? 'Uploading...' : 'Upload Materials'}
                    </button>
                  </div>
                  {weeklyMaterialFeedback && (
                    <div
                      className={`md:col-span-2 text-xs px-2 py-1 rounded border ${
                        weeklyMaterialFeedback.type === 'success'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {weeklyMaterialFeedback.text}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800">Materials for selected week</h4>
                {loadingWeeklyMaterials ? (
                  <div className="text-sm text-gray-400">Loading weekly materials...</div>
                ) : weeklyMaterials.length === 0 ? (
                  <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg px-3 py-4">
                    No materials uploaded for this week yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weeklyMaterials.map((item) => (
                      <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        {editingMaterialId === item.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingMaterialDraft.title}
                              onChange={(e) => setEditingMaterialDraft((prev) => ({ ...prev, title: e.target.value }))}
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                              placeholder="Material title"
                            />
                            <textarea
                              value={editingMaterialDraft.description}
                              onChange={(e) => setEditingMaterialDraft((prev) => ({ ...prev, description: e.target.value }))}
                              className="w-full min-h-[70px] rounded-lg border border-gray-300 px-2 py-1.5 text-sm resize-y"
                              placeholder="Description"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={editingMaterialDraft.week}
                                onChange={(e) => setEditingMaterialDraft((prev) => ({ ...prev, week: Number(e.target.value) }))}
                                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                              >
                                {ALL_WEEKS.map((weekItem) => (
                                  <option key={weekItem.week} value={weekItem.week}>
                                    {weekItem.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={editingMaterialDraft.lesson_number}
                                onChange={(e) => setEditingMaterialDraft((prev) => ({ ...prev, lesson_number: e.target.value }))}
                                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                                placeholder="Lesson #"
                              />
                            </div>
                            <input
                              type="text"
                              value={editingMaterialDraft.external_url}
                              onChange={(e) => setEditingMaterialDraft((prev) => ({ ...prev, external_url: e.target.value }))}
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                              placeholder="Link URL (optional if file exists)"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditWeeklyMaterial}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditWeeklyMaterial(item)}
                                className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-gray-800">{item.title}</div>
                              {item.description && (
                                <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{item.description}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-0.5">
                                {item.lesson_number ? `Lesson ${item.lesson_number}` : 'Week-level material'} · {new Date(item.created_at).toLocaleDateString('en-GB')}
                              </div>
                              {item.external_url ? (
                                <a
                                  href={item.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline break-all mt-1 inline-block"
                                >
                                  {item.external_url}
                                </a>
                              ) : null}
                              {item.storage_path ? (
                                <div className="mt-1">
                                  <WeeklyMaterialFileButton
                                    storagePath={item.storage_path}
                                    fileName={item.file_name}
                                    className="text-xs text-blue-600 hover:underline disabled:opacity-60"
                                  />
                                </div>
                              ) : null}
                            </div>
                            {canManageWeeklyUploads && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditWeeklyMaterial(item)}
                                  className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteWeeklyMaterial(item)}
                                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {(profile?.role === 'admin' || (profile?.role === 'teacher' && profile?.id === cls.teacher_id)) && selectedAnnouncement && (
            <div
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
              onClick={() => setSelectedAnnouncement(null)}
            >
              <div
                className="w-full max-w-lg bg-white rounded-xl border border-gray-200 p-5 max-h-[min(90vh,32rem)] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{selectedAnnouncement.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(selectedAnnouncement.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAnnouncement(null)}
                    className="text-gray-400 hover:text-gray-600 shrink-0"
                    aria-label="Close announcement"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4">
                  <div className="text-xs font-medium text-gray-500">Message</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{selectedAnnouncement.message}</div>
                  {selectedAnnouncement.link_url && (
                    <div className="mt-4 text-xs">
                      <span className="text-gray-500 font-medium">Link</span>
                      <div className="mt-1">
                        <a
                          href={selectedAnnouncement.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {selectedAnnouncement.link_url}
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedAnnouncement.attachment_url && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-gray-500 block mb-1">Attachment</span>
                      <AnnouncementPdfButton
                        storagePath={selectedAnnouncement.attachment_url}
                        fileName={selectedAnnouncement.attachment_name}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-60"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <Gradebook
          cls={cls}
          term={selectedTerm}
          onUnsavedChange={setHasUnsavedGradebook}
        />
      )}
    </Layout>
  )
}

// ── Resource Cards ────────────────────────────────────────────────────────────
function ResourceCards({ level, grade, programme, subject }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchResources = useCallback(async () => {
    let query = supabase
      .from('resource_links')
      .select('*')
      .eq('level', level)
      .eq('programme', programme)
      .eq('subject', subject)
      .order('sort_order')

    if (grade) {
      query = query.eq('grade', grade)
    }

    const { data } = await query
    setResources(data || [])
    setLoading(false)
  }, [level, grade, programme, subject])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  const TYPE_LABEL = { portal: 'Online Portal', drive: 'Google Drive', pdf: 'PDF', other: 'Link' }

  if (loading) return <div className="text-sm text-gray-400">Loading resources...</div>
  if (resources.length === 0) return (
    <div className="text-sm text-gray-400 italic">No resources added yet for this class type.</div>
  )

  return (
    <div className="grid grid-cols-2 gap-4 max-w-2xl sm:grid-cols-3">
      {resources.map(r => {
        const isComingSoon = !r.url
        return isComingSoon ? (
          <div key={r.id}
            className="rounded-xl border border-gray-200 p-5 bg-gray-50 opacity-60 cursor-not-allowed">
            <div className="font-semibold text-gray-400 text-sm">{r.title}</div>
            {r.description && <div className="text-xs text-gray-400 mt-1">{r.description}</div>}
            <div className="mt-3">
              <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-400 rounded-full">Coming Soon</span>
            </div>
          </div>
        ) : (
          <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border p-5 bg-white hover:shadow-md transition-all block"
            style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
            <div className="font-semibold text-gray-900 text-sm">{r.title}</div>
            {r.description && <div className="text-xs text-gray-500 mt-1">{r.description}</div>}
            <div className="mt-3">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: '#1f86c7' }}>
                {TYPE_LABEL[r.resource_type]}
              </span>
            </div>
          </a>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (score, total) => (total > 0 ? (score / total) * 100 : null)
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
const fmt = (n) => n != null ? n.toFixed(1) : '—'
const letterGradeFromPercentage = (score) => {
  if (score == null) return '—'
  if (score >= 90.5) return 'A*'
  if (score >= 79.5) return 'A'
  if (score >= 64.5) return 'B'
  if (score >= 49.5) return 'C'
  if (score >= 34.5) return 'D'
  return 'E'
}

const STUDENT_AVATAR_COL_CLASS = 'text-left px-3 py-3 text-slate-600 font-semibold sticky left-0 z-20 bg-slate-100/95 w-[64px] min-w-[64px] border-r border-slate-300'
const STUDENT_INFO_COL_CLASS = 'text-left px-4 py-3 text-slate-700 font-semibold sticky left-[64px] z-20 bg-slate-100/95 w-[240px] min-w-[240px] border-r border-slate-300'
const STUDENT_AVATAR_CELL_CLASS = 'px-3 py-3 sticky left-0 z-10 bg-white/95 backdrop-blur-sm border-r border-slate-300'
const STUDENT_INFO_CELL_CLASS = 'px-4 py-3 sticky left-[64px] z-10 bg-white/95 backdrop-blur-sm border-r border-slate-300'
const V2_TABLE_WRAP_CLASS = 'gradebook-grid bg-white rounded-2xl border border-slate-300 shadow-sm overflow-x-auto'
const V2_TABLE_HEAD_CLASS = 'bg-slate-100/80'
const V2_TABLE_BODY_CLASS = 'gradebook-grid-body'
const V2_ROW_CLASS = 'hover:bg-sky-50/40 min-h-[58px]'
const V2_PRIMARY_BTN = 'px-4 py-2 text-sm font-semibold text-white rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors'

const weightedNormalized = (items) => {
  const present = items.filter((item) => item.value != null)
  const totalWeight = present.reduce((sum, item) => sum + item.weight, 0)
  if (!totalWeight) return null
  return present.reduce((sum, item) => sum + item.value * (item.weight / totalWeight), 0)
}

const scoreColorClass = (score) => {
  if (score == null) return 'text-gray-300'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

const calcParticipationPct = (scoresOutOfTen) => {
  const valid = (scoresOutOfTen || []).filter((v) => v !== undefined && v !== '' && v !== null).map(Number)
  const average = avg(valid)
  return average != null ? average * 10 : null
}

const calcAssignmentAveragePct = ({ assignments, gradeByAssignmentId }) => {
  const pcts = (assignments || [])
    .map((assignment) => {
      const g = gradeByAssignmentId?.[assignment.id]
      if (!g || g.is_absent || g.score == null || g.score === '') return null
      return pct(parseFloat(g.score), assignment.max_points)
    })
    .filter((v) => v != null)
  return avg(pcts)
}

const calcAttainmentPct = ({ participationPct, assignmentPct }) => weightedNormalized([
  { value: participationPct, weight: 20 },
  { value: assignmentPct, weight: 80 },
])

const calcTotalPct = ({ attainmentPct, progressTestPct }) => weightedNormalized([
  { value: attainmentPct, weight: 75 },
  { value: progressTestPct, weight: 25 },
])

const readDraft = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

const writeDraft = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage failures in private mode/full quota
  }
}

const clearDraft = (key) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const handleGridCellKeyDown = (event) => {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) return
  const scope = event.currentTarget.dataset.gridScope
  const row = Number(event.currentTarget.dataset.gridRow)
  const col = Number(event.currentTarget.dataset.gridCol)
  if (!scope || Number.isNaN(row) || Number.isNaN(col)) return

  const inputs = [...document.querySelectorAll(`input[data-grid-scope="${scope}"]`)]
  const map = new Map(inputs.map((input) => [`${input.dataset.gridRow}_${input.dataset.gridCol}`, input]))
  let nextRow = row
  let nextCol = col
  if (event.key === 'ArrowUp') nextRow -= 1
  if (event.key === 'ArrowDown' || event.key === 'Enter') nextRow += 1
  if (event.key === 'ArrowLeft') nextCol -= 1
  if (event.key === 'ArrowRight') nextCol += 1

  const nextInput = map.get(`${nextRow}_${nextCol}`)
  if (nextInput) {
    event.preventDefault()
    nextInput.focus()
    nextInput.select?.()
  }
}

// ── Gradebook Shell ───────────────────────────────────────────────────────────
function Gradebook({ cls, term, onUnsavedChange }) {
  const [activeTab, setActiveTab] = useState('participation')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dirtyTabs, setDirtyTabs] = useState({})
  const [helpOpen, setHelpOpen] = useState(false)
  const isESL = cls.subject === 'ESL'
  const isFinal = term === 'final_1' || term === 'final_2'

  useEffect(() => { fetchStudents() }, [cls.id])

  const fetchStudents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('class_students')
      .select('students(id, student_id, name_eng, name_vn, avatar_url)')
      .eq('class_id', cls.id)
    const list = data?.map(d => d.students).sort((a, b) => a.name_eng.localeCompare(b.name_eng)) || []
    setStudents(list)
    setLoading(false)
  }

  const TABS = [
    { key: 'participation', label: 'Participation' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'progress_test', label: 'Progress Test' },
    { key: 'student_attributes', label: 'Student Attributes' },
    { key: 'summary', label: 'Summary' },
    ...(isFinal ? [{ key: 'comments', label: 'Comments' }] : []),
  ]

  const setTabDirty = (tabKey, isDirty) => {
    setDirtyTabs(prev => ({ ...prev, [tabKey]: isDirty }))
  }

  const hasAnyUnsaved = Object.values(dirtyTabs).some(Boolean)

  useEffect(() => {
    onUnsavedChange?.(hasAnyUnsaved)
  }, [hasAnyUnsaved, onUnsavedChange])

  useEffect(() => {
    sessionStorage.setItem('gradebook_unsaved_changes', hasAnyUnsaved ? '1' : '0')
  }, [hasAnyUnsaved])

  useEffect(() => {
    return () => {
      sessionStorage.setItem('gradebook_unsaved_changes', '0')
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasAnyUnsaved) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasAnyUnsaved])

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return
    if (dirtyTabs[activeTab]) {
      const leave = window.confirm('You have unsaved changes in this tab. Please click Save before switching tabs. Continue anyway?')
      if (!leave) return
    }
    setHelpOpen(false)
    setActiveTab(nextTab)
  }

  const isSaveTab = ['participation', 'assignments', 'progress_test', 'student_attributes'].includes(activeTab)
  const HELP_BY_TAB = {
    participation: [
      'Enter weekly participation scores out of 10.',
      'Use comment buttons for week-specific notes.',
      'Use Save to persist scores and comments.',
    ],
    assignments: [
      'Create assignments with name and total points.',
      'Scores are converted to percentages and averaged equally.',
      'Use A (absent) to exclude a score from averaging.',
    ],
    progress_test: [
      isESL ? 'Set total points for R/W, Listening, and Speaking.' : 'Set total points, then enter each student score.',
      isESL ? 'Overall is the average of the three component percentages.' : 'Overall is score divided by total points.',
      'Use Save to persist test scores and comments.',
    ],
    student_attributes: [
      'Mark each attribute as G, S, or N.',
      'Tap the same value again to clear it.',
      'Use Save to persist attribute selections.',
    ],
    summary: [
      'Summary values are calculated from saved Participation, Assignments, and Progress Test.',
      'Total = Attainment (75%) + Progress Test (25%).',
      'Final terms require final comments for Complete status.',
    ],
    comments: [
      'Write end-of-term comments per student.',
      'Comments are required for Final 1 and Final 2 completion.',
      'Missing counter shows students without comments.',
    ],
  }

  return (
    <div className="bg-gradient-to-b from-sky-50/70 to-white border border-sky-100 rounded-2xl p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-end gap-3 mb-3">
        <div className="flex items-center gap-3">
          {hasAnyUnsaved && (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              Unsaved Changes
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">
          No students enrolled in this class yet.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                    activeTab === tab.key
                      ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative flex items-center gap-2">
              {activeTab === 'assignments' && (
                <button
                  type="button"
                  onClick={() => {
                    document.dispatchEvent(new CustomEvent('gradebook-assignment-toggle-form'))
                  }}
                  className="px-3 py-2 text-sm font-semibold border border-slate-300 text-slate-700 rounded-xl bg-white hover:bg-slate-50"
                >
                  + New Assignment
                </button>
              )}
              {isSaveTab && (
                <button
                  type="button"
                  onClick={() => {
                    document.dispatchEvent(new CustomEvent('gradebook-save-tab', { detail: { tab: activeTab } }))
                  }}
                  className={V2_PRIMARY_BTN}
                >
                  Save
                </button>
              )}
              {activeTab === 'summary' && (
                <button
                  type="button"
                  onClick={() => {
                    document.dispatchEvent(new CustomEvent('gradebook-summary-refresh'))
                  }}
                  className="px-3 py-2 text-sm font-semibold border border-slate-300 text-slate-700 rounded-xl bg-white hover:bg-slate-50"
                >
                  ↻ Refresh
                </button>
              )}
              <button
                type="button"
                onClick={() => setHelpOpen((prev) => !prev)}
                className="w-8 h-8 rounded-full border border-slate-300 bg-white text-slate-600 text-sm font-bold hover:bg-slate-50"
                aria-label="Show tab guidance"
              >
                ?
              </button>
              {helpOpen && (
                <div className="absolute right-0 top-10 z-30 w-80 rounded-xl border border-slate-200 bg-white shadow-lg p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Tab guidance</div>
                  <ul className="text-xs text-slate-600 space-y-1.5">
                    {(HELP_BY_TAB[activeTab] || []).map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {activeTab === 'participation' && <ParticipationTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('participation', value)} />}
          {activeTab === 'assignments' && <AssignmentsTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('assignments', value)} />}
          {activeTab === 'progress_test' && <ProgressTestTab classId={cls.id} term={term} students={students} isESL={isESL} onDirtyChange={(value) => setTabDirty('progress_test', value)} />}
          {activeTab === 'student_attributes' && <StudentAttributesTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('student_attributes', value)} />}
          {activeTab === 'summary' && <SummaryTab classId={cls.id} term={term} students={students} isESL={isESL} />}
          {activeTab === 'comments' && isFinal && <CommentsTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('comments', value)} />}
        </>
      )}
    </div>
  )
}

// ── Participation Tab ─────────────────────────────────────────────────────────
function ParticipationTab({ classId, term, students, onDirtyChange }) {
  const [grades, setGrades] = useState({})
  const [saving, setSaving] = useState(false)
  const [openCommentKey, setOpenCommentKey] = useState(null)
  const [draftComment, setDraftComment] = useState('')
  const draftKey = `gradebook:draft:participation:${classId}:${term}`

  useEffect(() => { fetchGrades() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchGrades = async () => {
    const { data } = await supabase
      .from('participation_grades')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term)
    const map = {}
    data?.forEach(g => { map[`${g.student_id}_${g.week}`] = { score: g.score, comment: g.comment } })
    const draft = readDraft(draftKey, {})
    setGrades({ ...map, ...draft })
  }

  useEffect(() => {
    const timer = setTimeout(() => writeDraft(draftKey, grades), 350)
    return () => clearTimeout(timer)
  }, [draftKey, grades])

  const setGrade = (studentId, week, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [`${studentId}_${week}`]: { ...prev[`${studentId}_${week}`], [field]: value } }))
  }

  const openCommentEditor = (key) => {
    setOpenCommentKey(key)
    setDraftComment(grades[key]?.comment ?? '')
  }

  const saveComment = (studentId, week) => {
    setGrade(studentId, week, 'comment', draftComment)
    setOpenCommentKey(null)
    setDraftComment('')
  }

  const saveAll = async () => {
    if (saving) return
    setSaving(true)
    const rows = []
    weekSchedule.forEach(({ week, isNoScore }) => {
      if (isNoScore) return
      students.forEach(student => {
        const key = `${student.id}_${week}`
        const g = grades[key]
        const hasTouchedScore = g?.score !== undefined
        const hasTouchedComment = g?.comment !== undefined
        if (!hasTouchedScore && !hasTouchedComment) return

        const parsedScore = g?.score === '' || g?.score == null ? null : parseFloat(g.score)
        rows.push({
          class_id: classId,
          student_id: student.id,
          term,
          week,
          score: Number.isNaN(parsedScore) ? null : parsedScore,
          comment: g?.comment || null,
        })
      })
    })
    await supabase.from('participation_grades').upsert(rows, { onConflict: 'class_id,student_id,term,week' })
    setSaving(false)
    onDirtyChange?.(false)
    clearDraft(draftKey)
  }

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.tab === 'participation') saveAll()
    }
    document.addEventListener('gradebook-save-tab', handler)
    return () => document.removeEventListener('gradebook-save-tab', handler)
  })

  const getAvg = (studentId) => {
    const scores = weekSchedule
      .filter(w => !w.isNoScore)
      .map(w => grades[`${studentId}_${w.week}`]?.score)
    return calcParticipationPct(scores)
  }

  const weekSchedule = PARTICIPATION_WEEK_SCHEDULE[term] || Array.from({ length: 7 }, (_, idx) => ({
    week: idx + 1,
    label: `Week ${idx + 1}`,
    range: 'Date TBD',
  }))
  const studentRowMap = useMemo(
    () => Object.fromEntries(students.map((student, index) => [student.id, index])),
    [students]
  )
  const weekColMap = useMemo(
    () => Object.fromEntries(weekSchedule.map((w, index) => [w.week, index])),
    [weekSchedule]
  )

  return (
    <div>
      <div className={V2_TABLE_WRAP_CLASS}>
        <table className="w-full text-sm">
          <thead className={V2_TABLE_HEAD_CLASS}>
            <tr>
              <th className={STUDENT_AVATAR_COL_CLASS}></th>
              <th className={STUDENT_INFO_COL_CLASS}>Student Information</th>
              {weekSchedule.map((weekItem) => (
                <th key={weekItem.week} className="text-center px-2 py-3 font-medium min-w-28 bg-gray-200 text-gray-700 border-l border-gray-200">
                  <div>{weekItem.label}</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">{weekItem.range}</div>
                  {weekItem.isNoScore && (
                    <div className="text-[10px] text-rose-600 font-semibold mt-0.5">No Score</div>
                  )}
                </th>
              ))}
              <th className="text-center px-4 py-3 font-medium min-w-20 bg-green-100 text-green-800 border-l border-gray-200">Participation - Overall</th>
            </tr>
          </thead>
          <tbody className={V2_TABLE_BODY_CLASS}>
            {students.map(student => (
              <tr key={student.id} className={V2_ROW_CLASS}>
                <td className={STUDENT_AVATAR_CELL_CLASS}>
                  <ProfileAvatar 
                    avatarUrl={student.avatar_url} 
                    name={student.name_eng} 
                    size={28} 
                  />
                </td>
                <td className={STUDENT_INFO_CELL_CLASS}>
                  <div className="font-medium">
                    <span className="text-gray-900">{student.name_eng || '—'}</span>
                    <span className="text-gray-400 px-1">-</span>
                    <span className="text-blue-700">{student.name_vn || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                </td>
                {weekSchedule.map((weekItem) => {
                  const key = `${student.id}_${weekItem.week}`
                  const isNoScoreWeek = !!weekItem.isNoScore
                  return (
                    <td key={weekItem.week} className="px-2 py-2 bg-gray-50 border-l border-gray-200">
                      {isNoScoreWeek ? (
                        <div className="flex items-center justify-center h-[52px]">
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-semibold">
                            {weekItem.noScoreReason || 'No Score Week'}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input type="number" min="0" max="10" step="0.5" placeholder="—"
                            value={grades[key]?.score ?? ''}
                            onChange={e => setGrade(student.id, weekItem.week, 'score', e.target.value)}
                            onKeyDown={handleGridCellKeyDown}
                            data-grid-scope="participation-scores"
                            data-grid-row={studentRowMap[student.id]}
                            data-grid-col={weekColMap[weekItem.week]}
                            className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1 block mx-auto"
                          />
                          {openCommentKey === key ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id, weekItem.week)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentKey(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(key)}
                              className={`block mx-auto text-[10px] px-1.5 py-0.5 rounded border ${
                                grades[key]?.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {grades[key]?.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center bg-green-50 border-l border-gray-200">
                  <span className={`font-semibold ${
                    getAvg(student.id) != null 
                      ? getAvg(student.id) >= 80 ? 'text-green-600' 
                      : getAvg(student.id) >= 65 ? 'text-blue-600'
                      : getAvg(student.id) >= 50 ? 'text-amber-600'
                      : 'text-red-600'
                      : 'text-gray-300'
                  }`}>
                    {getAvg(student.id) != null ? fmt(getAvg(student.id)) : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Assignments Tab ───────────────────────────────────────────────────────────
function AssignmentsTab({ classId, term, students, onDirtyChange }) {
  const [assignments, setAssignments] = useState([])
  const [grades, setGrades] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [newAssignment, setNewAssignment] = useState({ name: '', max_points: '' })
  const [saving, setSaving] = useState(false)
  const [openCommentKey, setOpenCommentKey] = useState(null)
  const [draftComment, setDraftComment] = useState('')
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null)
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState(null)
  const draftKey = `gradebook:draft:assignments:${classId}:${term}`
  const studentRowMap = useMemo(
    () => Object.fromEntries(students.map((student, index) => [student.id, index])),
    [students]
  )
  const assignmentColMap = useMemo(
    () => Object.fromEntries(assignments.map((assignment, index) => [assignment.id, index])),
    [assignments]
  )

  useEffect(() => { fetchAssignments() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchAssignments = async () => {
    const { data: aData } = await supabase.from('assignments').select('*').eq('class_id', classId).eq('term', term).order('created_at')
    setAssignments(aData || [])
    if (aData?.length && students.length) {
      const assignmentIds = aData.map(a => a.id)
      const studentIds = students.map((s) => s.id)
      const { data: gData } = await supabase
        .from('assignment_grades')
        .select('*')
        .in('assignment_id', assignmentIds)
        .in('student_id', studentIds)
      const map = {}
      gData?.forEach(g => { map[`${g.assignment_id}_${g.student_id}`] = { score: g.score, is_absent: g.is_absent, comment: g.comment } })
      const draft = readDraft(draftKey, {})
      setGrades({ ...map, ...draft })
    } else {
      setGrades(readDraft(draftKey, {}))
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => writeDraft(draftKey, grades), 350)
    return () => clearTimeout(timer)
  }, [draftKey, grades])

  const createAssignment = async () => {
    if (!newAssignment.name || !newAssignment.max_points) return
    const { data } = await supabase.from('assignments').insert({ class_id: classId, term, name: newAssignment.name, max_points: parseFloat(newAssignment.max_points) }).select().single()
    setAssignments(prev => [...prev, data])
    setNewAssignment({ name: '', max_points: '' })
    setShowForm(false)
  }

  const deleteAssignment = async (assignment) => {
    setDeletingAssignmentId(assignment.id)
    await supabase.from('assignment_grades').delete().eq('assignment_id', assignment.id)
    await supabase.from('assignments').delete().eq('id', assignment.id)

    setAssignments(prev => prev.filter(a => a.id !== assignment.id))
    setGrades(prev => {
      const next = { ...prev }
      students.forEach(student => {
        delete next[`${assignment.id}_${student.id}`]
      })
      return next
    })
    setConfirmDeleteAssignment(null)
    setDeletingAssignmentId(null)
  }

  const setGrade = (assignmentId, studentId, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [`${assignmentId}_${studentId}`]: { ...prev[`${assignmentId}_${studentId}`], [field]: value } }))
  }

  const openCommentEditor = (key) => {
    setOpenCommentKey(key)
    setDraftComment(grades[key]?.comment ?? '')
  }

  const saveComment = (assignmentId, studentId) => {
    setGrade(assignmentId, studentId, 'comment', draftComment)
    setOpenCommentKey(null)
    setDraftComment('')
  }

  const getStudentAvg = (studentId) => {
    const gradeByAssignmentId = {}
    assignments.forEach((a) => {
      gradeByAssignmentId[a.id] = grades[`${a.id}_${studentId}`]
    })
    return calcAssignmentAveragePct({ assignments, gradeByAssignmentId })
  }

  const saveAll = async () => {
    if (saving) return
    setSaving(true)
    const rows = []
    assignments.forEach(assignment => {
      students.forEach(student => {
        const key = `${assignment.id}_${student.id}`
        const g = grades[key]
        if (g !== undefined) {
          rows.push({
            assignment_id: assignment.id,
            student_id: student.id,
            score: g.is_absent ? null : (g.score !== '' ? parseFloat(g.score) : null),
            is_absent: g.is_absent || false,
            comment: g.comment ? g.comment.trim() : null,
          })
        }
      })
    })
    await supabase.from('assignment_grades').upsert(rows, { onConflict: 'assignment_id,student_id' })
    setSaving(false)
    onDirtyChange?.(false)
    clearDraft(draftKey)
  }

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.tab === 'assignments') saveAll()
    }
    document.addEventListener('gradebook-save-tab', handler)
    return () => document.removeEventListener('gradebook-save-tab', handler)
  })

  useEffect(() => {
    const handler = () => setShowForm((prev) => !prev)
    document.addEventListener('gradebook-assignment-toggle-form', handler)
    return () => document.removeEventListener('gradebook-assignment-toggle-form', handler)
  }, [])

  return (
    <div>
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Assignment Name</label>
            <input type="text" placeholder="e.g. Essay 1" value={newAssignment.name}
              onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Total Points</label>
            <input type="number" placeholder="100" value={newAssignment.max_points}
              onChange={e => setNewAssignment({ ...newAssignment, max_points: e.target.value })}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={createAssignment} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
        </div>
      )}

      {confirmDeleteAssignment && (
        <div className="mb-4 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Delete <strong>{confirmDeleteAssignment.name}</strong>? This will remove all student scores for this assignment.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteAssignment(confirmDeleteAssignment)}
              disabled={deletingAssignmentId === confirmDeleteAssignment.id}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-300"
            >
              {deletingAssignmentId === confirmDeleteAssignment.id ? 'Deleting...' : 'Yes, delete assignment'}
            </button>
            <button
              onClick={() => setConfirmDeleteAssignment(null)}
              disabled={deletingAssignmentId === confirmDeleteAssignment.id}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No assignments yet. Create one to get started.</div>
      ) : (
        <div className={V2_TABLE_WRAP_CLASS}>
          <table className="w-full text-sm">
            <thead className={V2_TABLE_HEAD_CLASS}>
              <tr>
                <th className={STUDENT_AVATAR_COL_CLASS}></th>
              <th className={STUDENT_INFO_COL_CLASS}>Student Information</th>
                {assignments.map(a => (
                  <th key={a.id} className="text-center px-3 py-3 font-medium min-w-32 bg-gray-200 text-gray-700 border-l border-gray-200">
                    <div className="flex items-center justify-center gap-2">
                      <span>{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAssignment(a)}
                        disabled={deletingAssignmentId === a.id}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-red-200 text-red-500 text-xs leading-none hover:bg-red-50 disabled:opacity-50"
                        title={`Delete ${a.name}`}
                        aria-label={`Delete ${a.name}`}
                      >
                        {deletingAssignmentId === a.id ? '…' : '×'}
                      </button>
                    </div>
                    <div className="text-xs font-normal text-gray-400">/ {a.max_points}</div>
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-medium min-w-24 bg-green-100 text-green-800 border-l border-gray-200">Assignments - Overall</th>
              </tr>
            </thead>
            <tbody className={V2_TABLE_BODY_CLASS}>
              {students.map(student => (
                <tr key={student.id} className={V2_ROW_CLASS}>
                  <td className={STUDENT_AVATAR_CELL_CLASS}>
                    <ProfileAvatar 
                      avatarUrl={student.avatar_url} 
                      name={student.name_eng} 
                      size={28} 
                    />
                  </td>
                  <td className={STUDENT_INFO_CELL_CLASS}>
                    <div className="font-medium">
                      <span className="text-gray-900">{student.name_eng || '—'}</span>
                      <span className="text-gray-400 px-1">-</span>
                      <span className="text-blue-700">{student.name_vn || '—'}</span>
                    </div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                  {assignments.map(assignment => {
                    const key = `${assignment.id}_${student.id}`
                    const g = grades[key] || {}
                    return (
                      <td key={assignment.id} className="px-3 py-2 text-center bg-gray-50 border-l border-gray-200">
                        {g.is_absent ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-xs font-medium">Absent</span>
                            <button onClick={() => setGrade(assignment.id, student.id, 'is_absent', false)} className="text-xs text-gray-400 hover:text-gray-600">undo</button>
                            {openCommentKey === key ? (
                              <div className="w-full space-y-1">
                                <input
                                  type="text"
                                  placeholder="Type comment"
                                  value={draftComment}
                                  onChange={e => setDraftComment(e.target.value)}
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveComment(assignment.id, student.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCommentKey(null)
                                      setDraftComment('')
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCommentEditor(key)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  g.comment
                                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {g.comment ? 'Edit Comment' : 'Add Comment'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <input type="number" min="0" max={assignment.max_points} placeholder="—"
                              value={g.score ?? ''}
                              onChange={e => setGrade(assignment.id, student.id, 'score', e.target.value)}
                              onKeyDown={handleGridCellKeyDown}
                              data-grid-scope="assignment-scores"
                              data-grid-row={studentRowMap[student.id]}
                              data-grid-col={assignmentColMap[assignment.id]}
                              className="w-[80px] text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => setGrade(assignment.id, student.id, 'is_absent', true)} className="text-xs text-gray-400 hover:text-orange-500">A (absent)</button>
                            {openCommentKey === key ? (
                              <div className="w-full space-y-1">
                                <input
                                  type="text"
                                  placeholder="Type comment"
                                  value={draftComment}
                                  onChange={e => setDraftComment(e.target.value)}
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveComment(assignment.id, student.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCommentKey(null)
                                      setDraftComment('')
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCommentEditor(key)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  g.comment
                                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {g.comment ? 'Edit Comment' : 'Add Comment'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center bg-green-50 border-l border-gray-200">
                    <span className={`font-semibold ${getStudentAvg(student.id) != null ? 'text-blue-600' : 'text-gray-300'}`}>
                      {fmt(getStudentAvg(student.id))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Progress Test Tab ─────────────────────────────────────────────────────────
function ProgressTestTab({ classId, term, students, isESL, onDirtyChange }) {
  const [grades, setGrades] = useState({})
  const [totals, setTotals] = useState(
    isESL
      ? { rw_total: '', l_total: '', s_total: '' }
      : { total_points: '' }
  )
  const [saving, setSaving] = useState(false)
  const [openCommentStudentId, setOpenCommentStudentId] = useState(null)
  const [draftComment, setDraftComment] = useState('')
  const gradesDraftKey = `gradebook:draft:progress:${classId}:${term}:${isESL ? 'esl' : 'single'}:grades`
  const totalsDraftKey = `gradebook:draft:progress:${classId}:${term}:${isESL ? 'esl' : 'single'}:totals`
  const studentRowMap = useMemo(
    () => Object.fromEntries(students.map((student, index) => [student.id, index])),
    [students]
  )

  useEffect(() => { fetchGrades() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term, isESL])

  const fetchGrades = async () => {
    const { data } = await supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('term', term)
    const map = {}
    if (isESL && data?.[0]) {
      setTotals({
        rw_total: data[0].reading_writing_total || '',
        l_total: data[0].listening_total || '',
        s_total: data[0].speaking_total || '',
      })
    } else if (!isESL && data?.[0]) {
      setTotals({ total_points: data[0].total_points || '' })
    }
    data?.forEach(g => {
      map[g.student_id] = isESL
        ? { rw: g.reading_writing_score, l: g.listening_score, s: g.speaking_score, comment: g.test_comment ?? g.comment ?? null }
        : { score: g.score, comment: g.test_comment ?? g.comment ?? null }
    })
    setGrades({ ...map, ...readDraft(gradesDraftKey, {}) })
    const totalsDraft = readDraft(totalsDraftKey, null)
    if (totalsDraft && typeof totalsDraft === 'object') {
      setTotals(prev => ({ ...prev, ...totalsDraft }))
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => writeDraft(gradesDraftKey, grades), 350)
    return () => clearTimeout(timer)
  }, [gradesDraftKey, grades])

  useEffect(() => {
    const timer = setTimeout(() => writeDraft(totalsDraftKey, totals), 350)
    return () => clearTimeout(timer)
  }, [totalsDraftKey, totals])

  const setGrade = (studentId, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }))
  }

  const openCommentEditor = (studentId) => {
    setOpenCommentStudentId(studentId)
    setDraftComment(grades[studentId]?.comment ?? '')
  }

  const saveComment = (studentId) => {
    setGrade(studentId, 'comment', draftComment)
    setOpenCommentStudentId(null)
    setDraftComment('')
  }

  const getOverall = (studentId) => {
    const g = grades[studentId]
    if (!g) return null
    if (isESL) {
      const rwPct = totals.rw_total && g.rw !== '' && g.rw != null ? pct(parseFloat(g.rw), parseFloat(totals.rw_total)) : null
      const lPct = totals.l_total && g.l !== '' && g.l != null ? pct(parseFloat(g.l), parseFloat(totals.l_total)) : null
      const sPct = totals.s_total && g.s !== '' && g.s != null ? pct(parseFloat(g.s), parseFloat(totals.s_total)) : null
      const valid = [rwPct, lPct, sPct].filter(p => p !== null)
      return valid.length === 3 ? avg(valid) : null
    } else {
      return totals.total_points && g.score !== '' && g.score != null ? pct(parseFloat(g.score), parseFloat(totals.total_points)) : null
    }
  }

  const saveAll = async () => {
    if (saving) return
    setSaving(true)
    const rows = students.map(student => {
      const g = grades[student.id] || {}
      const overall = getOverall(student.id)
      if (isESL) {
        return {
          class_id: classId, student_id: student.id, term,
          reading_writing_score: g.rw != null && g.rw !== '' ? parseFloat(g.rw) : null,
          reading_writing_total: totals.rw_total ? parseFloat(totals.rw_total) : null,
          listening_score: g.l != null && g.l !== '' ? parseFloat(g.l) : null,
          listening_total: totals.l_total ? parseFloat(totals.l_total) : null,
          speaking_score: g.s != null && g.s !== '' ? parseFloat(g.s) : null,
          speaking_total: totals.s_total ? parseFloat(totals.s_total) : null,
          overall_percentage: overall,
          test_comment: g.comment ? g.comment.trim() : null,
        }
      } else {
        return {
          class_id: classId, student_id: student.id, term,
          score: g.score != null && g.score !== '' ? parseFloat(g.score) : null,
          total_points: totals.total_points ? parseFloat(totals.total_points) : null,
          overall_percentage: overall,
          test_comment: g.comment ? g.comment.trim() : null,
        }
      }
    })
    let saveError = null
    const { error: firstError } = await supabase
      .from('progress_test_grades')
      .upsert(rows, { onConflict: 'class_id,student_id,term' })

    if (firstError) {
      const msg = String(firstError.message || '')
      const missingTestCommentColumn = msg.includes('test_comment') && msg.toLowerCase().includes('column')

      if (missingTestCommentColumn) {
        const fallbackRows = rows.map((row) => {
          const { test_comment, ...rest } = row
          return { ...rest, comment: test_comment ?? null }
        })
        const { error: fallbackError } = await supabase
          .from('progress_test_grades')
          .upsert(fallbackRows, { onConflict: 'class_id,student_id,term' })
        saveError = fallbackError
      } else {
        saveError = firstError
      }
    }

    if (saveError) {
      setSaving(false)
      return
    }

    setSaving(false)
    onDirtyChange?.(false)
    clearDraft(gradesDraftKey)
    clearDraft(totalsDraftKey)
  }

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.tab === 'progress_test') saveAll()
    }
    document.addEventListener('gradebook-save-tab', handler)
    return () => document.removeEventListener('gradebook-save-tab', handler)
  })

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mb-3 flex gap-3 items-end">
        {isESL ? (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Reading & Writing — Total Points</label>
              <input type="number" placeholder="e.g. 50" value={totals.rw_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, rw_total: e.target.value }))
                }}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Listening — Total Points</label>
              <input type="number" placeholder="e.g. 40" value={totals.l_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, l_total: e.target.value }))
                }}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Speaking — Total Points</label>
              <input type="number" placeholder="e.g. 10" value={totals.s_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, s_total: e.target.value }))
                }}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Total Points</label>
            <input type="number" placeholder="e.g. 100" value={totals.total_points}
              onChange={e => {
                onDirtyChange?.(true)
                setTotals(prev => ({ ...prev, total_points: e.target.value }))
              }}
              className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      <div className={V2_TABLE_WRAP_CLASS}>
        <table className="w-full text-sm">
          <thead className={V2_TABLE_HEAD_CLASS}>
            <tr>
              <th className={STUDENT_AVATAR_COL_CLASS}></th>
              <th className={STUDENT_INFO_COL_CLASS}>Student Information</th>
              {isESL ? (
                <>
                  <th className="text-center px-3 py-3 font-medium min-w-36 bg-gray-200 text-gray-700 border-l border-gray-200">Reading & Writing - Score</th>
                  <th className="text-center px-3 py-3 font-medium min-w-32 bg-gray-200 text-gray-700 border-l border-gray-200">Listening - Score</th>
                  <th className="text-center px-3 py-3 font-medium min-w-32 bg-gray-200 text-gray-700 border-l border-gray-200">Speaking - Score</th>
                  <th className="text-center px-3 py-3 font-medium min-w-36 bg-green-100 text-green-800 border-l border-gray-300" style={{ backgroundClip: 'padding-box' }}>Reading & Writing - %</th>
                  <th className="text-center px-3 py-3 font-medium min-w-32 bg-green-100 text-green-800 border-l border-gray-300" style={{ backgroundClip: 'padding-box' }}>Listening - %</th>
                  <th className="text-center px-3 py-3 font-medium min-w-32 bg-green-100 text-green-800 border-l border-gray-300" style={{ backgroundClip: 'padding-box' }}>Speaking - %</th>
                  <th className="text-center px-4 py-3 font-medium min-w-24 bg-green-100 text-green-800 border-l border-gray-200" style={{ backgroundClip: 'padding-box' }}>Overall</th>
                </>
              ) : (
                <>
                <th className="text-center px-3 py-3 font-medium bg-gray-200 text-gray-800 border-l border-gray-300 min-w-40" style={{ backgroundClip: 'padding-box' }}>
                  Progress Test - Points
                </th>
                <th className="text-center px-3 py-3 font-medium bg-green-100 text-green-800 border-l border-gray-300 min-w-36" style={{ backgroundClip: 'padding-box' }}>
                  Progress Test - Percentage
                </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className={V2_TABLE_BODY_CLASS}>
            {students.map(student => {
              const g = grades[student.id] || {}
              const overall = getOverall(student.id)
              return (
                <tr key={student.id} className={V2_ROW_CLASS}>
                  <td className={STUDENT_AVATAR_CELL_CLASS}>
                    <ProfileAvatar 
                      avatarUrl={student.avatar_url} 
                      name={student.name_eng} 
                      size={28} 
                    />
                  </td>
                  <td className={STUDENT_INFO_CELL_CLASS}>
                    <div className="font-medium">
                      <span className="text-gray-900">{student.name_eng || '—'}</span>
                      <span className="text-gray-400 px-1">-</span>
                      <span className="text-blue-700">{student.name_vn || '—'}</span>
                    </div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                  {isESL ? (
                    <>
                    <td className="px-3 py-2 text-center bg-gray-50 border-l border-gray-200">
                      <div className="flex flex-col items-center gap-1">
                        <input type="number" min="0" max={totals.rw_total || undefined} placeholder="—"
                          value={g.rw ?? ''}
                          onChange={e => setGrade(student.id, 'rw', e.target.value)}
                          onKeyDown={handleGridCellKeyDown}
                          data-grid-scope="progress-esl-scores"
                          data-grid-row={studentRowMap[student.id]}
                          data-grid-col={0}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          {openCommentStudentId === student.id ? (
                            <div className="w-full space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentStudentId(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(student.id)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                g.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {g.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center bg-gray-50 border-l border-gray-200">
                        <div className="flex flex-col items-center gap-1">
                          <input type="number" min="0" max={totals.l_total || undefined} placeholder="—"
                            value={g.l ?? ''}
                            onChange={e => setGrade(student.id, 'l', e.target.value)}
                            onKeyDown={handleGridCellKeyDown}
                            data-grid-scope="progress-esl-scores"
                            data-grid-row={studentRowMap[student.id]}
                            data-grid-col={1}
                            className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          
                          {openCommentStudentId === student.id ? (
                            <div className="w-full space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentStudentId(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(student.id)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                g.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {g.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center bg-gray-50 border-l border-gray-200">
                        <div className="flex flex-col items-center gap-1">
                          <input type="number" min="0" max={totals.s_total || undefined} placeholder="—"
                            value={g.s ?? ''}
                            onChange={e => setGrade(student.id, 's', e.target.value)}
                            onKeyDown={handleGridCellKeyDown}
                            data-grid-scope="progress-esl-scores"
                            data-grid-row={studentRowMap[student.id]}
                            data-grid-col={2}
                            className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          
                          {openCommentStudentId === student.id ? (
                            <div className="w-full space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentStudentId(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(student.id)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                g.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {g.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center bg-green-50 border-l border-gray-200">
                        <span className="font-semibold text-gray-700">
                          {totals.rw_total && g.rw != null ? fmt(pct(parseFloat(g.rw), parseFloat(totals.rw_total))) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center bg-green-50 border-l border-gray-200">
                        <span className="font-semibold text-gray-700">
                          {totals.l_total && g.l != null ? fmt(pct(parseFloat(g.l), parseFloat(totals.l_total))) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center bg-green-50 border-l border-gray-200">
                        <span className="font-semibold text-gray-700">
                          {totals.s_total && g.s != null ? fmt(pct(parseFloat(g.s), parseFloat(totals.s_total))) : '—'}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <input type="number" min="0" max={totals.total_points || undefined} placeholder="—"
                          value={g.score ?? ''}
                          onChange={e => setGrade(student.id, 'score', e.target.value)}
                          onKeyDown={handleGridCellKeyDown}
                          data-grid-scope="progress-single-scores"
                          data-grid-row={studentRowMap[student.id]}
                          data-grid-col={0}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {openCommentStudentId === student.id ? (
                          <div className="w-full space-y-1">
                            <input
                              type="text"
                              placeholder="Type comment"
                              value={draftComment}
                              onChange={e => setDraftComment(e.target.value)}
                              className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => saveComment(student.id)}
                                className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCommentStudentId(null)
                                  setDraftComment('')
                                }}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCommentEditor(student.id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              g.comment
                                ? 'border-blue-200 bg-blue-50 text-blue-600'
                                : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {g.comment ? 'Edit Comment' : 'Add Comment'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-center bg-green-50 border-l border-gray-200">
                    <span className={`font-semibold ${overall != null ? 'text-blue-600' : 'text-gray-300'}`}>
                      {fmt(overall)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Student Attributes Tab ────────────────────────────────────────────────────
function StudentAttributesTab({ classId, term, students, onDirtyChange }) {
  const [attributes, setAttributes] = useState({})
  const [saving, setSaving] = useState(false)
  const draftKey = `gradebook:draft:attributes:${classId}:${term}`

  const ATTRIBUTE_FIELDS = [
    { key: 'confident', label: 'Confident' },
    { key: 'responsible', label: 'Responsible' },
    { key: 'reflective', label: 'Reflective' },
    { key: 'innovative', label: 'Innovative' },
    { key: 'engaged', label: 'Engaged' },
  ]

  useEffect(() => { fetchAttributes() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchAttributes = async () => {
    const { data } = await supabase
      .from('student_attributes')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term)

    const map = {}
    data?.forEach((row) => {
      map[row.student_id] = {
        confident: row.confident || '',
        responsible: row.responsible || '',
        reflective: row.reflective || '',
        innovative: row.innovative || '',
        engaged: row.engaged || '',
      }
    })
    setAttributes({ ...map, ...readDraft(draftKey, {}) })
  }

  useEffect(() => {
    const timer = setTimeout(() => writeDraft(draftKey, attributes), 350)
    return () => clearTimeout(timer)
  }, [draftKey, attributes])

  const setAttribute = (studentId, field, value) => {
    onDirtyChange?.(true)
    setAttributes(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }))
  }

  const saveAll = async () => {
    if (saving) return
    setSaving(true)
    const rows = students.map((student) => {
      const values = attributes[student.id] || {}
      return {
        class_id: classId,
        student_id: student.id,
        term,
        confident: values.confident || null,
        responsible: values.responsible || null,
        reflective: values.reflective || null,
        innovative: values.innovative || null,
        engaged: values.engaged || null,
      }
    })

    await supabase
      .from('student_attributes')
      .upsert(rows, { onConflict: 'class_id,student_id,term' })

    setSaving(false)
    onDirtyChange?.(false)
    clearDraft(draftKey)
  }

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.tab === 'student_attributes') saveAll()
    }
    document.addEventListener('gradebook-save-tab', handler)
    return () => document.removeEventListener('gradebook-save-tab', handler)
  })

  return (
    <div>
      <div className={V2_TABLE_WRAP_CLASS}>
        <table className="w-full text-sm">
          <thead className={V2_TABLE_HEAD_CLASS}>
            <tr>
              <th className={STUDENT_AVATAR_COL_CLASS}></th>
              <th className={STUDENT_INFO_COL_CLASS}>Student Information</th>
              {ATTRIBUTE_FIELDS.map(field => (
                <th key={field.key} className="text-center px-3 py-3 font-medium min-w-44 border-l border-gray-300 bg-blue-100 text-blue-800" style={{ backgroundClip: 'padding-box' }}>
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={V2_TABLE_BODY_CLASS}>
            {students.map((student) => {
              const row = attributes[student.id] || {}
              return (
                <tr key={student.id} className={V2_ROW_CLASS}>
                  <td className={STUDENT_AVATAR_CELL_CLASS}>
                    <ProfileAvatar 
                      avatarUrl={student.avatar_url} 
                      name={student.name_eng} 
                      size={28} 
                    />
                  </td>
                  <td className={STUDENT_INFO_CELL_CLASS}>
                    <div className="font-medium">
                      <span className="text-gray-900">{student.name_eng || '—'}</span>
                      <span className="text-gray-400 px-1">-</span>
                      <span className="text-blue-700">{student.name_vn || '—'}</span>
                    </div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                   {ATTRIBUTE_FIELDS.map(field => {
                     const currentValue = row[field.key] ?? ''
                     return (
                       <td key={field.key} className="px-3 py-2 text-center border-l border-gray-300 bg-blue-50" style={{ backgroundClip: 'padding-box' }}>
                        <div className="flex justify-center gap-1">
                           {/* G Button - Good */}
                           <button
                             type="button"
                             onClick={() => setAttribute(student.id, field.key, currentValue === 'G' ? '' : 'G')}
                            className={`min-w-[44px] h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
                               currentValue === 'G'
                                ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-200'
                                : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600'
                             }`}
                             title="Good"
                           >
                             G
                           </button>
                           
                           {/* S Button - Satisfactory */}
                           <button
                             type="button"
                             onClick={() => setAttribute(student.id, field.key, currentValue === 'S' ? '' : 'S')}
                            className={`min-w-[44px] h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
                               currentValue === 'S'
                                ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200'
                                : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600'
                             }`}
                             title="Satisfactory"
                           >
                             S
                           </button>
                           
                           {/* N Button - Needs Improvement */}
                           <button
                             type="button"
                             onClick={() => setAttribute(student.id, field.key, currentValue === 'N' ? '' : 'N')}
                            className={`min-w-[44px] h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
                               currentValue === 'N'
                                ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-200'
                                : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600'
                             }`}
                             title="Needs Improvement"
                           >
                             N
                           </button>
                         </div>
                       </td>
                     )
                   })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ classId, term, students, isESL }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [attributes, setAttributes] = useState({})
  const [finalCommentsByStudent, setFinalCommentsByStudent] = useState({})
  const isFinalTerm = term === 'final_1' || term === 'final_2'

  const ATTRIBUTE_FIELDS = [
    { key: 'confident', label: 'Confident' },
    { key: 'responsible', label: 'Responsible' },
    { key: 'reflective', label: 'Reflective' },
    { key: 'innovative', label: 'Innovative' },
    { key: 'engaged', label: 'Engaged' },
  ]

  useEffect(() => { fetchAll() }, [classId, term])

  useEffect(() => {
    const handler = () => fetchAll()
    document.addEventListener('gradebook-summary-refresh', handler)
    return () => document.removeEventListener('gradebook-summary-refresh', handler)
  }, [classId, term])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: partData }, 
      { data: assignData }, 
      { data: ptData },
      { data: attributesData },
      { data: finalCommentsData }
    ] = await Promise.all([
      supabase.from('participation_grades').select('*').eq('class_id', classId).eq('term', term),
      supabase.from('assignments').select('*').eq('class_id', classId).eq('term', term),
      supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('term', term),
      supabase.from('student_attributes').select('*').eq('class_id', classId).eq('term', term),
      isFinalTerm ? supabase.from('term_comments').select('student_id, comment').eq('class_id', classId).eq('term', term) : Promise.resolve({ data: [] }),
    ])

    const assignmentIds = (assignData || []).map((a) => a.id)
    const studentIds = students.map((s) => s.id)
    const { data: assignGrades } = assignmentIds.length
      ? await supabase.from('assignment_grades').select('*').in('assignment_id', assignmentIds).in('student_id', studentIds)
      : { data: [] }

    const summary = {}
    const attributesMap = {}
    const ptByStudent = {}
    const assignmentGradeByKey = {}
    const participationByStudent = {}
    const commentsMap = {}

    attributesData?.forEach(row => {
      attributesMap[row.student_id] = {
        confident: row.confident,
        responsible: row.responsible,
        reflective: row.reflective,
        innovative: row.innovative,
        engaged: row.engaged,
      }
    })

    partData?.forEach((row) => {
      if (row.score == null) return
      if (!participationByStudent[row.student_id]) participationByStudent[row.student_id] = []
      participationByStudent[row.student_id].push(row.score)
    })

    assignGrades?.forEach((row) => {
      assignmentGradeByKey[`${row.assignment_id}_${row.student_id}`] = row
    })

    ptData?.forEach((row) => {
      ptByStudent[row.student_id] = row
    })

    ;(finalCommentsData || []).forEach((row) => {
      commentsMap[row.student_id] = row.comment || ''
    })

    students.forEach(student => {
      const partScores = participationByStudent[student.id] || []
      const partAvg = avg(partScores)
      const partPct = partAvg != null ? (partAvg / 10) * 100 : null

      const assignPcts = (assignData || []).map(a => {
        const g = assignmentGradeByKey[`${a.id}_${student.id}`]
        if (!g || g.is_absent || g.score == null) return null
        return pct(g.score, a.max_points)
      }).filter(p => p !== null) || []
      const assignAvg = avg(assignPcts)

      const attainment = calcAttainmentPct({ participationPct: partPct, assignmentPct: assignAvg })

      const pt = ptByStudent[student.id]
      const ptOverall = pt?.overall_percentage ?? null

      const hasParticipation = partPct != null
      const hasAssignments = assignAvg != null
      const hasProgressTest = ptOverall != null

      const total = calcTotalPct({ attainmentPct: attainment, progressTestPct: ptOverall })

      const hasFinalComment = !isFinalTerm || Boolean(String(commentsMap[student.id] || '').trim())
      const completedComponents = [hasParticipation, hasAssignments, hasProgressTest].filter(Boolean).length
      const calcStatus = completedComponents === 3
        ? (hasFinalComment ? 'Complete' : 'Partial')
        : completedComponents === 0
          ? 'Missing'
          : 'Partial'

      summary[student.id] = { 
        partPct, 
        assignAvg, 
        attainment, 
        ptOverall, 
        total,
        calcStatus,
        ptRW: pt?.reading_writing_total && pt?.reading_writing_score != null ? pct(parseFloat(pt.reading_writing_score), parseFloat(pt.reading_writing_total)) : null,
        ptListening: pt?.listening_total && pt?.listening_score != null ? pct(parseFloat(pt.listening_score), parseFloat(pt.listening_total)) : null,
        ptSpeaking: pt?.speaking_total && pt?.speaking_score != null ? pct(parseFloat(pt.speaking_score), parseFloat(pt.speaking_total)) : null,
      }
    })

    setData(summary)
    setAttributes(attributesMap)
    setFinalCommentsByStudent(commentsMap)
    setLoading(false)
  }

  return (
    <div>
      {loading ? (
        <div className="text-center text-gray-400 py-10">Calculating...</div>
      ) : (
        <div className={V2_TABLE_WRAP_CLASS}>
          <table className="w-full text-sm border-collapse">
            <thead className={V2_TABLE_HEAD_CLASS}>
            <tr>
              <th className={STUDENT_AVATAR_COL_CLASS}></th>
              <th className={STUDENT_INFO_COL_CLASS}>Student Information</th>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Participation</th>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">Marked Assignments</th>
                <th className="text-center px-4 py-3 font-medium bg-green-100 text-green-800 border-l border-gray-200">Attainment</th>
                
                {isESL ? (
                  <>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">Progress Test (R/W)</th>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">Progress Test (L)</th>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">Progress Test (S)</th>
                  </>
                ) : null}

                <th className="text-center px-4 py-3 font-medium bg-green-100 text-green-800 border-l border-gray-200">Progress Test</th>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">Overall</th>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">Grade</th>
                <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">Status</th>
                {isFinalTerm ? (
                  <th className="text-center px-3 py-3 font-medium bg-gray-200 text-gray-700 border-l border-gray-200">
                    Final Comment
                  </th>
                ) : null}
                
                {ATTRIBUTE_FIELDS.map(attr => (
                  <th key={attr.key} className="text-center px-3 py-3 font-medium bg-blue-100 text-blue-800 text-xs">
                    {attr.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={V2_TABLE_BODY_CLASS}>
              {students.map(student => {
                const d = data[student.id] || {}
                const attrs = attributes[student.id] || {}
                return (
                  <tr key={student.id} className="hover:bg-gray-50 border-b border-gray-200 min-h-[56px]">
                    <td className={STUDENT_AVATAR_CELL_CLASS}>
                    <ProfileAvatar 
                      avatarUrl={student.avatar_url} 
                      name={student.name_eng} 
                      size={28} 
                    />
                  </td>
                  <td className={STUDENT_INFO_CELL_CLASS}>
                      <div className="font-medium">
                        <span className="text-gray-900">{student.name_eng || '—'}</span>
                        <span className="text-gray-400 px-1">-</span>
                        <span className="text-blue-700">{student.name_vn || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                    </td>
                    <td className={`px-4 py-3 text-center font-medium bg-gray-50 ${scoreColorClass(d.partPct)} border-l border-gray-200`}>{fmt(d.partPct)}</td>
                    <td className={`px-4 py-3 text-center font-medium bg-gray-50 ${scoreColorClass(d.assignAvg)} border-l border-gray-200`}>{fmt(d.assignAvg)}</td>
                    <td className={`px-4 py-3 text-center font-semibold bg-green-50 ${scoreColorClass(d.attainment)}`}>{fmt(d.attainment)}</td>
                    
                    {isESL ? (
                      <>
                        <td className="px-4 py-3 text-center bg-gray-50 text-gray-600 border-l border-gray-200">{fmt(d.ptRW)}</td>
                        <td className="px-4 py-3 text-center bg-gray-50 text-gray-600 border-l border-gray-200">{fmt(d.ptListening)}</td>
                        <td className="px-4 py-3 text-center bg-gray-50 text-gray-600 border-l border-gray-200">{fmt(d.ptSpeaking)}</td>
                      </>
                    ) : null}

                    <td className={`px-4 py-3 text-center font-medium bg-green-50 ${scoreColorClass(d.ptOverall)}`}>{fmt(d.ptOverall)}</td>
                    <td className={`px-4 py-3 text-center font-bold bg-gray-50 ${scoreColorClass(d.total)}`}>{fmt(d.total)}</td>
                    <td className="px-4 py-3 text-center bg-gray-50">
                      <span className="font-semibold text-gray-800">{letterGradeFromPercentage(d.total)}</span>
                    </td>
                    <td className="px-4 py-3 text-center bg-gray-50 border-l border-gray-200">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        d.calcStatus === 'Complete'
                          ? 'text-green-700 bg-green-100 border border-green-200'
                          : d.calcStatus === 'Partial'
                            ? 'text-amber-700 bg-amber-100 border border-amber-200'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                      }`}>
                        {d.calcStatus || 'Missing'}
                      </span>
                    </td>
                    {isFinalTerm ? (
                      <td className="px-3 py-3 text-center bg-gray-50 border-l border-gray-200">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          String(finalCommentsByStudent[student.id] || '').trim()
                            ? 'text-green-700 bg-green-100 border-green-200'
                            : 'text-rose-700 bg-rose-100 border-rose-200'
                        }`}>
                          {String(finalCommentsByStudent[student.id] || '').trim() ? 'Completed' : 'Required'}
                        </span>
                      </td>
                    ) : null}
                    
                    {ATTRIBUTE_FIELDS.map(attr => (
                      <td key={attr.key} className="px-3 py-3 text-center bg-blue-50">
                        <span className="text-gray-600">{attrs[attr.key] || '—'}</span>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Comments Tab ──────────────────────────────────────────────────────────────
function CommentsTab({ classId, term, students, onDirtyChange }) {
  const [comments, setComments] = useState({})
  const [originalComments, setOriginalComments] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const draftKey = `gradebook:draft:comments:${classId}:${term}`

  useEffect(() => { fetchComments() }, [classId, term])
  useEffect(() => { 
    const hasChanges = Object.entries(comments).some(([id, val]) => originalComments[id] !== val)
    onDirtyChange?.(hasChanges) 
  }, [comments, originalComments])

  const fetchComments = async () => {
    const { data } = await supabase.from('term_comments').select('*').eq('class_id', classId).eq('term', term)
    const map = {}
    const original = {}
    data?.forEach(c => { 
      map[c.student_id] = c.comment 
      original[c.student_id] = c.comment
    })
    setComments({ ...map, ...readDraft(draftKey, {}) })
    setOriginalComments(original)
  }

  useEffect(() => {
    const timer = setTimeout(() => writeDraft(draftKey, comments), 350)
    return () => clearTimeout(timer)
  }, [draftKey, comments])

  const saveComment = async (studentId) => {
    setSaving(true)
    
    await supabase.from('term_comments').upsert({
      class_id: classId,
      student_id: studentId,
      term,
      comment: comments[studentId]?.trim() || null
    }, { onConflict: 'class_id,student_id,term' })
    
    setOriginalComments(prev => ({ ...prev, [studentId]: comments[studentId] }))
    setSaving(false)
    setSaved(true)
    setEditingStudentId(null)
    clearDraft(draftKey)
    
    setTimeout(() => setSaved(false), 2000)
  }

  const cancelEdit = (studentId) => {
    setComments(prev => ({ ...prev, [studentId]: originalComments[studentId] ?? '' }))
    setEditingStudentId(null)
  }

  const isDirty = (studentId) => {
    return comments[studentId] !== originalComments[studentId]
  }
  const missingCount = students.filter((student) => !String(comments[student.id] || '').trim()).length

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          <span className="text-amber-700 font-medium">Missing: {missingCount}</span>
        </p>
        {saved && <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">✓ Saved</span>}
      </div>
      <div className={V2_TABLE_WRAP_CLASS}>
        <table className="w-full text-sm">
          <thead className={V2_TABLE_HEAD_CLASS}>
            <tr>
              <th className={STUDENT_AVATAR_COL_CLASS}></th>
              <th className={STUDENT_INFO_COL_CLASS}>Student Information</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Comment</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-28 min-w-28">Actions</th>
            </tr>
          </thead>
          <tbody className={V2_TABLE_BODY_CLASS}>
            {students.map(student => (
              <tr key={student.id} className={V2_ROW_CLASS}>
                <td className={STUDENT_AVATAR_CELL_CLASS}>
                  <ProfileAvatar 
                    avatarUrl={student.avatar_url} 
                    name={student.name_eng} 
                    size={28} 
                  />
                </td>
                <td className={STUDENT_INFO_CELL_CLASS}>
                  <div className="font-medium">
                    <span className="text-gray-900">{student.name_eng || '—'}</span>
                    <span className="text-gray-400 px-1">-</span>
                    <span className="text-blue-700">{student.name_vn || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <textarea 
                    rows={editingStudentId === student.id ? 4 : 1} 
                    placeholder="Write a comment for this student..."
                    value={comments[student.id] ?? ''}
                    onChange={e => {
                      setComments(prev => ({ ...prev, [student.id]: e.target.value }))
                    }}
                    onFocus={() => setEditingStudentId(student.id)}
                    onBlur={() => !isDirty(student.id) && setEditingStudentId(null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {isDirty(student.id) && (
                      <>
                        <button 
                          onClick={() => saveComment(student.id)} 
                          disabled={saving}
                          className="px-3 py-1 text-xs rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          onClick={() => cancelEdit(student.id)}
                          className="px-3 py-1 text-xs rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {!isDirty(student.id) && editingStudentId !== student.id && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
