<script setup lang="ts">import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import type { AnnotationType, AnnotationSeverity } from '@/types/annotation';
import { ReviewerAction } from '@/types/review';
import { reviewApi } from '@/api/annotation';
import { documentApi } from '@/api/document';
const reviewStore = useReviewStore();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const showAnnotationDialog = ref(false);
const annotationContent = ref('');
const annotationSeverity = ref<AnnotationSeverity>('medium');
const annotationAssignee = ref<string>('')
const showCompareDialog = ref(false);
const compareVersionId = ref('');
const showReviewDialog = ref(false);
const reviewAction = ref<ReviewerAction>(ReviewerAction.APPROVE);
const reviewComment = ref('');
const uploadProgress = ref(0);
const isUploading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const tools = computed<{
 type: AnnotationType | 'select';
 label: string;
 icon: any;
}[]>(() => [
 { type: 'select', label: '选择', icon: 'Pointer' },
 { type: 'rectangle', label: '矩形', icon: 'Rectangle' },
 { type: 'circle', label: '圆形', icon: 'Circle' },
 { type: 'arrow', label: '箭头', icon: 'Right' },
 { type: 'freeform', label: '自由线', icon: 'EditPen' }
]);
const canAnnotate = computed(() => {
 if (!reviewStore.currentDocument)
 return false;
 return reviewStore.currentDocument.permissions.canAnnotate;
});
const pageCount = computed(() => reviewStore.currentVersion?.pageCount || 1);
function setTool(type: AnnotationType | 'select') {
 if (type === 'select') {
 reviewStore.setActiveTool(null);
 reviewStore.clearDraft();
 }
 else {
 reviewStore.setActiveTool(type);
 }
}
function isActiveTool(type: AnnotationType | 'select') {
 if (type === 'select')
 return !reviewStore.canvas.activeTool;
 return reviewStore.canvas.activeTool === type;
}
function handleZoomIn() {
 reviewStore.zoomIn();
}
function handleZoomOut() {
 reviewStore.zoomOut();
}
function handleResetZoom() {
 reviewStore.resetZoom();
}
function handlePrevPage() {
 if (reviewStore.canvas.currentPage > 1) {
 reviewStore.setCurrentPage(reviewStore.canvas.currentPage - 1);
 }
}
function handleNextPage() {
 if (reviewStore.canvas.currentPage < pageCount.value) {
 reviewStore.setCurrentPage(reviewStore.canvas.currentPage + 1);
 }
}
function openAnnotationDialog() {
 if (!reviewStore.draftAnnotation.geometry) {
 ElMessage.warning('请先在图纸上绘制批注区域');
 return;
 }
 showAnnotationDialog.value = true;
 annotationContent.value = '';
 annotationSeverity.value = 'medium';
 annotationAssignee.value = '';
}
async function submitAnnotation() {
  if (!annotationContent.value.trim()) {
    ElMessage.warning('请输入批注内容');
    return;
  }
  const mentionRegex = /@([\w\u4e00-\u9fa5]+)/g;
  const mentions: string[] = [];
  let m;
  while ((m = mentionRegex.exec(annotationContent.value)) !== null) {
    if (!mentions.includes(m[1])) mentions.push(m[1]);
  }
  const result = await reviewStore.createAnnotation({
    content: annotationContent.value.trim(),
    severity: annotationSeverity.value,
    assigneeId: annotationAssignee.value || undefined,
    mentions
  });
 if (result) {
 ElMessage.success('批注创建成功');
 showAnnotationDialog.value = false;
 }
 else {
 ElMessage.error('批注创建失败');
 }
}
function cancelAnnotation() {
 showAnnotationDialog.value = false;
 reviewStore.clearDraft();
}
function openCompareDialog() {
 if (!reviewStore.currentDocument || reviewStore.currentDocument.versions.length < 2) {
 ElMessage.warning('至少需要两个版本才能对比');
 return;
 }
 showCompareDialog.value = true;
}
function startCompare() {
 if (!compareVersionId.value) {
 ElMessage.warning('请选择对比版本');
 return;
 }
 reviewStore.enterCompareMode(compareVersionId.value);
 showCompareDialog.value = false;
}
function exitCompare() {
 reviewStore.exitCompareMode();
}
function triggerUpload() {
 fileInputRef.value?.click();
}
async function handleFileUpload(e: Event) {
 const target = e.target as HTMLInputElement;
 const file = target.files?.[0];
 if (!file || !reviewStore.currentDocument)
 return;
 isUploading.value = true;
 uploadProgress.value = 0;
 try {
 await documentApi.uploadVersion({
 documentId: reviewStore.currentDocument.id,
 description: '新版本上传',
 file,
 onProgress: (p) => (uploadProgress.value = p)
 });
 ElMessage.success('版本上传成功');
 await reviewStore.loadDocument(reviewStore.currentDocument.id);
 }
 catch (err) {
 ElMessage.error('上传失败');
 }
 finally {
 isUploading.value = false;
 uploadProgress.value = 0;
 if (fileInputRef.value)
 fileInputRef.value.value = '';
 }
}
function downloadDocument() {
 if (!reviewStore.currentDocument)
 return;
 ElMessageBox.confirm('下载的图纸将自动叠加您的用户水印，是否继续？', '下载确认', {
 confirmButtonText: '下载',
 type: 'info'
 })
 .then(async () => {
 try {
 const blob = await documentApi.download(reviewStore.currentDocument!.id, true);
 const url = URL.createObjectURL(blob as Blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${reviewStore.currentDocument!.name}.pdf`;
 a.click();
 URL.revokeObjectURL(url);
 }
 catch {
 ElMessage.error('下载失败');
 }
 })
 .catch(() => { });
}
function openReviewDialog() {
 showReviewDialog.value = true;
 reviewAction.value = ReviewerAction.APPROVE;
 reviewComment.value = '';
}
async function submitReview() {
 if (!reviewStore.currentWorkflow)
 return;
 if (reviewStore.currentWorkflow.stages[reviewStore.currentWorkflow.currentStageIndex]?.config.requireComment &&
 !reviewComment.value.trim()) {
 ElMessage.warning('当前审批阶段必须填写审批意见');
 return;
 }
 try {
 await reviewApi.takeAction(reviewStore.currentWorkflow.id, {
 action: reviewAction.value,
 comment: reviewComment.value.trim()
 });
 ElMessage.success('审批操作已提交');
 showReviewDialog.value = false;
 await reviewStore.loadWorkflows(reviewStore.currentDocument!.id);
 }
 catch {
 ElMessage.error('审批操作失败');
 }
}
function getStageIcon(index: number, currentIndex: number, isCompleted: boolean) {
 if (isCompleted)
 return 'CircleCheck';
 if (index < currentIndex)
 return 'CircleCheckFilled';
 if (index === currentIndex)
 return 'Loading';
 return 'CircleClose';
}
watch(() => reviewStore.draftAnnotation.geometry, (geo) => {
 if (geo) {
 openAnnotationDialog();
 }
});
</script>

<template>
  <div class="review-toolbar">
    <div class="toolbar-left">
      <div class="tool-group drawing-tools">
        <el-tooltip
          v-for="tool in tools"
          :key="tool.type"
          :content="tool.label"
          placement="bottom"
        >
          <el-button
            :type="isActiveTool(tool.type) ? 'primary' : 'default'"
            size="small"
            :disabled="!canAnnotate"
            @click="setTool(tool.type)"
          >
            <el-icon>
              <component :is="tool.icon" />
            </el-icon>
          </el-button>
        </el-tooltip>

        <el-divider direction="vertical" />

        <el-button
          type="success"
          size="small"
          :disabled="!reviewStore.draftAnnotation.geometry"
          @click="openAnnotationDialog"
        >
          <el-icon><ChatDotRound /></el-icon>
          确认批注
        </el-button>
      </div>

      <div class="tool-group view-tools">
        <el-tooltip content="缩小" placement="bottom">
          <el-button size="small" @click="handleZoomOut">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
        </el-tooltip>
        <span class="zoom-label">{{ Math.round(reviewStore.canvas.zoom * 100) }}%</span>
        <el-tooltip content="放大" placement="bottom">
          <el-button size="small" @click="handleZoomIn">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="重置视图" placement="bottom">
          <el-button size="small" @click="handleResetZoom">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="显示网格" placement="bottom">
          <el-button
            size="small"
            :type="reviewStore.canvas.showGrid ? 'primary' : 'default'"
            @click="reviewStore.canvas.showGrid = !reviewStore.canvas.showGrid"
          >
            <el-icon><Grid /></el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <div class="tool-group page-tools">
        <el-button size="small" :disabled="reviewStore.canvas.currentPage <= 1" @click="handlePrevPage">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="page-label">
          {{ reviewStore.canvas.currentPage }} / {{ pageCount }}
        </span>
        <el-button size="small" :disabled="reviewStore.canvas.currentPage >= pageCount" @click="handleNextPage">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="toolbar-center" v-if="reviewStore.currentWorkflow">
      <div class="workflow-progress">
        <div class="progress-stages">
          <div
            v-for="(stage, index) in reviewStore.currentWorkflow.stages"
            :key="stage.id"
            class="progress-stage"
            :class="{
              completed: stage.isCompleted,
              current: stage.isCurrent,
              pending: !stage.isCompleted && !stage.isCurrent
            }"
          >
            <div class="stage-node">
              <div class="stage-icon-wrapper">
                <transition name="stage-icon" mode="out-in">
                  <el-icon v-if="stage.isCompleted" key="done" class="stage-icon done"><CircleCheckFilled /></el-icon>
                  <el-icon v-else-if="stage.isCurrent" key="active" class="stage-icon active"><Loading /></el-icon>
                  <el-icon v-else key="wait" class="stage-icon wait"><CircleClose /></el-icon>
                </transition>
              </div>
              <span class="stage-label">{{ stage.config.name }}</span>
            </div>
            <div v-if="index < reviewStore.currentWorkflow.stages.length - 1" class="stage-connector">
              <div class="connector-track">
                <div
                  class="connector-fill"
                  :class="{ filled: stage.isCompleted, animating: stage.isCurrent }"
                ></div>
              </div>
            </div>
          </div>
        </div>
        <div class="progress-summary">
          <span class="summary-text">
            审批进度 {{ reviewStore.currentWorkflow.currentStageIndex + 1 }} / {{ reviewStore.currentWorkflow.stages.length }}
          </span>
          <el-progress
            :percentage="Math.round(((reviewStore.currentWorkflow.currentStageIndex + (reviewStore.currentWorkflow.stages[reviewStore.currentWorkflow.currentStageIndex]?.isCompleted ? 1 : 0)) / reviewStore.currentWorkflow.stages.length) * 100)"
            :stroke-width="6"
            :show-text="false"
            status="success"
          />
        </div>
      </div>
    </div>

    <div class="toolbar-right">
      <el-dropdown v-if="reviewStore.currentDocument?.versions && reviewStore.currentDocument.versions.length > 1" trigger="click">
        <el-button size="small">
          <el-icon><CollectionTag /></el-icon>
          版本 v{{ reviewStore.currentVersion?.major }}.{{ reviewStore.currentVersion?.minor }}
          <el-icon><CaretBottom /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="v in [...reviewStore.currentDocument.versions].reverse()"
              :key="v.id"
              :command="v.id"
              @click="reviewStore.switchVersion(v.id)"
            >
              v{{ v.major }}.{{ v.minor }} - {{ v.uploaderName }}
              <span v-if="v.id === reviewStore.currentVersion?.id" style="color:#10b981;margin-left:8px">当前</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button
        v-if="!reviewStore.isCompareMode"
        size="small"
        type="warning"
        @click="openCompareDialog"
      >
        <el-icon><ScaleToOriginal /></el-icon>
        版本对比
      </el-button>
      <el-button
        v-else
        size="small"
        type="danger"
        @click="exitCompare"
      >
        <el-icon><Close /></el-icon>
        退出对比
      </el-button>

      <el-button
        v-if="authStore.isDesigner || authStore.isProjectManager"
        size="small"
        type="primary"
        :loading="isUploading"
        @click="triggerUpload"
      >
        <el-icon><Upload /></el-icon>
        {{ isUploading ? `上传中 ${uploadProgress}%` : '上传新版本' }}
      </el-button>
      <input
        ref="fileInputRef"
        type="file"
        accept=".pdf,.dwg,.png,.jpg,.jpeg"
        style="display:none"
        @change="handleFileUpload"
      />

      <el-button size="small" @click="downloadDocument">
        <el-icon><Download /></el-icon>
        下载
      </el-button>

      <el-button
        v-if="reviewStore.currentWorkflow?.stages[reviewStore.currentWorkflow.currentStageIndex]?.isCurrent"
        size="small"
        type="success"
        @click="openReviewDialog"
      >
        <el-icon><Check /></el-icon>
        审批
      </el-button>

      <el-divider direction="vertical" />

      <el-button size="small" @click="themeStore.toggleAnnotationPanel">
        <el-icon><ChatDotRound /></el-icon>
      </el-button>
    </div>

    <el-dialog
      v-model="showAnnotationDialog"
      title="新建批注"
      width="480px"
      :close-on-click-modal="false"
      @close="cancelAnnotation"
    >
      <el-form label-width="80px">
        <el-form-item label="批注内容">
          <el-input
            v-model="annotationContent"
            type="textarea"
            :rows="4"
            placeholder="请描述图纸问题... 使用 @用户名 提及他人"
          />
        </el-form-item>
        <el-form-item label="严重程度">
          <el-radio-group v-model="annotationSeverity">
            <el-radio-button value="low">低</el-radio-button>
            <el-radio-button value="medium">中</el-radio-button>
            <el-radio-button value="high">高</el-radio-button>
            <el-radio-button value="critical">严重</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="指派人">
          <el-input v-model="annotationAssignee" placeholder="可输入用户ID或选择..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelAnnotation">取消</el-button>
        <el-button type="primary" @click="submitAnnotation">确认提交</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showCompareDialog"
      title="选择对比版本"
      width="420px"
    >
      <el-form label-width="80px">
        <el-form-item label="基准版本">
          <el-tag>v{{ reviewStore.currentVersion?.major }}.{{ reviewStore.currentVersion?.minor }}</el-tag>
        </el-form-item>
        <el-form-item label="对比版本">
          <el-select v-model="compareVersionId" placeholder="请选择要对比的版本" style="width:100%">
            <el-option
              v-for="v in reviewStore.currentDocument?.versions.filter(vv => vv.id !== reviewStore.currentVersion?.id) || []"
              :key="v.id"
              :label="`v${v.major}.${v.minor} - ${v.uploaderName}`"
              :value="v.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompareDialog = false">取消</el-button>
        <el-button type="primary" @click="startCompare">开始对比</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showReviewDialog"
      title="审批意见"
      width="500px"
    >
      <el-form label-width="80px">
        <el-form-item label="审批操作">
          <el-radio-group v-model="reviewAction">
            <el-radio-button :value="ReviewerAction.APPROVE">通过</el-radio-button>
            <el-radio-button :value="ReviewerAction.REQUEST_REVISION">需修改</el-radio-button>
            <el-radio-button :value="ReviewerAction.REJECT">驳回</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          label="审批意见"
          :required="reviewStore.currentWorkflow?.stages[reviewStore.currentWorkflow.currentStageIndex]?.config.requireComment"
        >
          <el-input
            v-model="reviewComment"
            type="textarea"
            :rows="4"
            placeholder="请输入审批意见..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReviewDialog = false">取消</el-button>
        <el-button type="primary" @click="submitReview">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: $bg-base;
  border-bottom: 1px solid $border-color;
  gap: 16px;
  flex-wrap: wrap;

  .dark & {
    background: $dark-bg-light;
    border-bottom-color: $dark-border-color;
  }
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 4px;

  .zoom-label,
  .page-label {
    font-size: 13px;
    color: $text-secondary;
    min-width: 60px;
    text-align: center;
  }
}

.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 300px;

  .workflow-progress {
    width: 100%;
    max-width: 600px;
  }

  .progress-stages {
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .progress-stage {
    display: flex;
    align-items: flex-start;
    gap: 0;

    &.completed .stage-icon-wrapper {
      background: #10b981;
      border-color: #10b981;
    }

    &.current .stage-icon-wrapper {
      background: $primary-color;
      border-color: $primary-color;
      animation: pulse-ring 2s ease-in-out infinite;
    }

    &.pending .stage-icon-wrapper {
      background: $bg-light;
      border-color: $border-color;
    }
  }

  .stage-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 64px;
  }

  .stage-icon-wrapper {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

    .stage-icon {
      font-size: 16px;
      color: #fff;

      &.wait {
        color: $text-placeholder;
      }
    }

    .dark & {
      &.completed { background: #10b981; border-color: #10b981; }
      &.current { background: $primary-color; border-color: $primary-color; }
      &.pending { background: $dark-bg-base; border-color: $dark-border-color; }
    }
  }

  .stage-label {
    font-size: 12px;
    color: $text-secondary;
    white-space: nowrap;
    text-align: center;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stage-connector {
    display: flex;
    align-items: center;
    padding-top: 14px;
    width: 40px;
  }

  .connector-track {
    width: 100%;
    height: 4px;
    background: $bg-light;
    border-radius: 2px;
    overflow: hidden;

    .dark & {
      background: $dark-bg-base;
    }
  }

  .connector-fill {
    height: 100%;
    width: 0;
    background: #10b981;
    border-radius: 2px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);

    &.filled {
      width: 100%;
    }

    &.animating {
      width: 0;
      animation: fill-progress 2s ease-in-out infinite;
    }
  }

  .progress-summary {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;

    .summary-text {
      font-size: 12px;
      color: $text-secondary;
      white-space: nowrap;
    }

    :deep(.el-progress) {
      flex: 1;
    }
  }
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(29, 78, 216, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(29, 78, 216, 0); }
  100% { box-shadow: 0 0 0 0 rgba(29, 78, 216, 0); }
}

@keyframes fill-progress {
  0% { width: 0; }
  50% { width: 60%; }
  100% { width: 40%; }
}

.stage-icon-enter-active,
.stage-icon-leave-active {
  transition: all 0.3s ease;
}
.stage-icon-enter-from {
  transform: scale(0.5);
  opacity: 0;
}
.stage-icon-leave-to {
  transform: scale(1.5);
  opacity: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .review-toolbar {
    padding: 8px;
    gap: 8px;
  }

  .toolbar-center {
    order: 3;
    width: 100%;
    min-width: auto;
  }
}
</style>
