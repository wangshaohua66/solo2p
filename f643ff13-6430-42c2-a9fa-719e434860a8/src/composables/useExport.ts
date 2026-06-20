import { ref } from 'vue'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import html2canvas from 'html2canvas'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { formatFullTime, formatTime, getRoleName, getAnnotationColor, dataUrlToBlob, downloadFile } from '@/utils/storage'
import type { Annotation } from '@/types'

export function useExport() {
  const transcriptStore = useTranscriptStore()
  const evidenceStore = useEvidenceStore()

  const isExporting = ref(false)
  const exportProgress = ref(0)
  const exportError = ref<string | null>(null)

  const generateTranscriptText = (): string => {
    const caseInfo = transcriptStore.currentCase
    let text = `\n${'='.repeat(60)}\n`
    text += `\t\t法庭庭审笔录\n`
    text += `${'='.repeat(60)}\n\n`
    text += `案号：${caseInfo?.caseNumber || ''}\n`
    text += `案由：${caseInfo?.caseName || ''}\n`
    text += `开庭时间：${formatFullTime(transcriptStore.startTime || Date.now())}\n`
    text += `记录时间：${formatFullTime(Date.now())}\n\n`
    text += `${'-'.repeat(60)}\n\n`

    transcriptStore.activeTranscripts.forEach((t, index) => {
      const time = formatTime(t.timestamp + transcriptStore.startTime)
      const role = getRoleName(t.role)
      text += `[${index + 1}] ${time} ${role}：${t.content}\n\n`

      const annotations = transcriptStore.getAnnotationsByTranscriptId(t.id)
      if (annotations.length > 0) {
        text += `\t【标注】：\n`
        annotations.forEach(a => {
          text += `\t  - [${getAnnotationTypeName(a.type)}] ${getRoleName(a.role)}：${a.content}\n`
        })
        text += `\n`
      }

      if (t.evidenceIds.length > 0) {
        const evidenceNames = t.evidenceIds
          .map(id => evidenceStore.getEvidenceById(id)?.name)
          .filter(Boolean)
        if (evidenceNames.length > 0) {
          text += `\t【关联证据】：${evidenceNames.join('、')}\n\n`
        }
      }
    })

    const allAnnotations = transcriptStore.annotations
    if (allAnnotations.length > 0) {
      text += `\n${'='.repeat(60)}\n`
      text += `\t\t标注汇总\n`
      text += `${'='.repeat(60)}\n\n`

      const groupedAnnotations: Record<string, Annotation[]> = {
        dispute: [],
        proof: [],
        defense: [],
        note: []
      }
      allAnnotations.forEach(a => {
        groupedAnnotations[a.type].push(a)
      })

      Object.entries(groupedAnnotations).forEach(([type, anns]) => {
        if (anns.length > 0) {
          text += `【${getAnnotationTypeName(type)}】共${anns.length}条：\n`
          anns.forEach(a => {
            const transcript = transcriptStore.getTranscriptById(a.transcriptId)
            const time = transcript ? formatTime(transcript.timestamp + transcriptStore.startTime) : ''
            text += `  ${time} [${getRoleName(a.role)}] ${a.content}\n`
          })
          text += `\n`
        }
      })
    }

    const evidenceList = evidenceStore.evidenceItems
    if (evidenceList.length > 0) {
      text += `\n${'='.repeat(60)}\n`
      text += `\t\t证据清单\n`
      text += `${'='.repeat(60)}\n\n`
      evidenceList.forEach((e, index) => {
        text += `${index + 1}. ${e.name}\n`
        text += `   类型：${getEvidenceTypeName(e.type)}，大小：${formatFileSize(e.fileSize)}\n\n`
      })
    }

    return text
  }

  const getAnnotationTypeName = (type: string): string => {
    const names: Record<string, string> = {
      dispute: '争议焦点',
      proof: '举证要点',
      defense: '质证意见',
      note: '备注'
    }
    return names[type] || type
  }

  const getEvidenceTypeName = (type: string): string => {
    const names: Record<string, string> = {
      pdf: 'PDF文档',
      image: '图片',
      video: '视频',
      audio: '音频',
      document: '文档'
    }
    return names[type] || type
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const exportToTxt = () => {
    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      const content = generateTranscriptText()
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const filename = `${transcriptStore.currentCase?.caseNumber || '庭审笔录'}_${formatFullTime(Date.now()).replace(/[:\s]/g, '-')}.txt`
      downloadFile(blob, filename)
      exportProgress.value = 100
    } catch (error) {
      exportError.value = error instanceof Error ? error.message : '导出失败'
    } finally {
      setTimeout(() => {
        isExporting.value = false
      }, 500)
    }
  }

  const exportToPdf = async () => {
    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const contentWidth = pageWidth - margin * 2
      let y = margin

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('法庭庭审笔录', pageWidth / 2, y, { align: 'center' })
      y += 15

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      const caseInfo = transcriptStore.currentCase
      doc.text(`案号：${caseInfo?.caseNumber || ''}`, margin, y)
      y += 7
      doc.text(`案由：${caseInfo?.caseName || ''}`, margin, y)
      y += 7
      doc.text(`开庭时间：${formatFullTime(transcriptStore.startTime || Date.now())}`, margin, y)
      y += 7
      doc.text(`记录时间：${formatFullTime(Date.now())}`, margin, y)
      y += 10

      doc.setLineWidth(0.5)
      doc.line(margin, y, pageWidth - margin, y)
      y += 8

      exportProgress.value = 20

      const transcripts = transcriptStore.activeTranscripts
      for (let i = 0; i < transcripts.length; i++) {
        const t = transcripts[i]
        const time = formatTime(t.timestamp + transcriptStore.startTime)
        const role = getRoleName(t.role)

        if (y > pageHeight - margin) {
          doc.addPage()
          y = margin
        }

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(getAnnotationColor(t.role))
        doc.text(`[${i + 1}] ${time} ${role}：`, margin, y)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)

        const lines = doc.splitTextToSize(t.content, contentWidth - 30)
        doc.text(lines, margin + 30, y)
        y += lines.length * 6 + 3

        const annotations = transcriptStore.getAnnotationsByTranscriptId(t.id)
        if (annotations.length > 0 && y < pageHeight - margin) {
          doc.setFontSize(10)
          doc.setTextColor(100, 100, 100)
          annotations.forEach(a => {
            if (y > pageHeight - margin) {
              doc.addPage()
              y = margin
            }
            const annotationText = doc.splitTextToSize(
              `  【${getAnnotationTypeName(a.type)}】${getRoleName(a.role)}：${a.content}`,
              contentWidth - 20
            )
            doc.text(annotationText, margin + 10, y)
            y += annotationText.length * 5 + 2
          })
          doc.setFontSize(12)
          doc.setTextColor(0, 0, 0)
          y += 3
        }

        exportProgress.value = 20 + Math.floor((i / transcripts.length) * 60)
      }

      exportProgress.value = 80

      const allAnnotations = transcriptStore.annotations
      if (allAnnotations.length > 0) {
        doc.addPage()
        y = margin

        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('标注汇总', pageWidth / 2, y, { align: 'center' })
        y += 12

        const groupedAnnotations: Record<string, Annotation[]> = {
          dispute: [],
          proof: [],
          defense: [],
          note: []
        }
        allAnnotations.forEach(a => {
          groupedAnnotations[a.type].push(a)
        })

        for (const [type, anns] of Object.entries(groupedAnnotations)) {
          if (anns.length > 0) {
            if (y > pageHeight - margin) {
              doc.addPage()
              y = margin
            }

            doc.setFontSize(14)
            doc.setTextColor(getAnnotationColor(type))
            doc.setFont('helvetica', 'bold')
            doc.text(`【${getAnnotationTypeName(type)}】共${anns.length}条`, margin, y)
            y += 8

            doc.setFontSize(11)
            doc.setTextColor(0, 0, 0)
            doc.setFont('helvetica', 'normal')

            for (const a of anns) {
              if (y > pageHeight - margin) {
                doc.addPage()
                y = margin
              }
              const transcript = transcriptStore.getTranscriptById(a.transcriptId)
              const time = transcript ? formatTime(transcript.timestamp + transcriptStore.startTime) : ''
              const text = doc.splitTextToSize(
                `  ${time} [${getRoleName(a.role)}] ${a.content}`,
                contentWidth - 10
              )
              doc.text(text, margin, y)
              y += text.length * 5 + 2
            }
            y += 5
          }
        }
      }

      exportProgress.value = 95

      const filename = `${transcriptStore.currentCase?.caseNumber || '庭审笔录'}_${formatFullTime(Date.now()).replace(/[:\s]/g, '-')}.pdf`
      doc.save(filename)
      exportProgress.value = 100
    } catch (error) {
      exportError.value = error instanceof Error ? error.message : '导出PDF失败'
    } finally {
      setTimeout(() => {
        isExporting.value = false
      }, 500)
    }
  }

  const exportToZip = async () => {
    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      const zip = new JSZip()
      const caseNumber = transcriptStore.currentCase?.caseNumber || '庭审案件'

      const transcriptText = generateTranscriptText()
      zip.file('庭审笔录.txt', transcriptText)

      const transcriptDoc = new jsPDF()
      transcriptDoc.text(transcriptText, 10, 10, { maxWidth: 190 })
      const pdfBlob = transcriptDoc.output('blob')
      zip.file('庭审笔录.pdf', pdfBlob)

      exportProgress.value = 30

      const evidenceFolder = zip.folder('证据材料')
      const totalEvidence = evidenceStore.evidenceItems.length

      for (let i = 0; i < totalEvidence; i++) {
        const evidence = evidenceStore.evidenceItems[i]
        if (evidence.dataUrl) {
          const blob = dataUrlToBlob(evidence.dataUrl)
          evidenceFolder?.file(`${i + 1}_${evidence.name}`, blob)
        }
        exportProgress.value = 30 + Math.floor(((i + 1) / totalEvidence) * 40)
      }

      exportProgress.value = 80

      const annotationsJson = JSON.stringify({
        caseInfo: transcriptStore.currentCase,
        annotations: transcriptStore.annotations,
        exportedAt: Date.now()
      }, null, 2)
      zip.file('标注信息.json', annotationsJson)

      const manifest = `
案件归档清单
============
案号：${caseNumber}
导出时间：${formatFullTime(Date.now())}

文件清单：
1. 庭审笔录.txt - 完整庭审笔录
2. 庭审笔录.pdf - PDF格式笔录
3. 标注信息.json - 结构化标注数据
4. 证据材料/ - 证据文件目录（共${totalEvidence}份）

笔录条目：${transcriptStore.activeTranscripts.length}条
标注数量：${transcriptStore.annotations.length}条
证据数量：${totalEvidence}份
      `.trim()
      zip.file('归档说明.txt', manifest)

      exportProgress.value = 95

      const content = await zip.generateAsync({ type: 'blob' })
      const filename = `${caseNumber}_完整案卷_${formatFullTime(Date.now()).replace(/[:\s]/g, '-')}.zip`
      downloadFile(content, filename)
      exportProgress.value = 100
    } catch (error) {
      exportError.value = error instanceof Error ? error.message : '导出ZIP失败'
    } finally {
      setTimeout(() => {
        isExporting.value = false
      }, 500)
    }
  }

  const captureScreenshot = async (element: HTMLElement, filename: string) => {
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2
      })
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png', 1.0)
      })
      downloadFile(blob, filename)
      return true
    } catch (error) {
      exportError.value = error instanceof Error ? error.message : '截图失败'
      return false
    }
  }

  return {
    isExporting,
    exportProgress,
    exportError,
    generateTranscriptText,
    exportToTxt,
    exportToPdf,
    exportToZip,
    captureScreenshot
  }
}
