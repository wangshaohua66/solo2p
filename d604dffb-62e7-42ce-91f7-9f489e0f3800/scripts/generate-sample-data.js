import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const directors = ['张艺谋剧组', '陈凯歌剧组', '冯小刚剧组', '王家卫剧组', '贾樟柯剧组',
  '李安剧组', '姜文剧组', '宁浩剧组', '管虎剧组', '吴京剧组',
  '郭帆剧组', '陈思诚剧组', '文牧野剧组', '路阳剧组', '韩寒剧组'];

const statuses = ['preparation', 'production', 'mixing', 'delivery'];
const materialStatuses = ['pending', 'editing', 'review', 'confirmed', 'revision'];
const types = ['dialogue', 'ambience', 'foley', 'music'];
const editors = ['李明', '王芳', '张伟', '刘洋', '陈静', '杨磊', '黄磊', '周涛'];
const mixers = ['孙强', '吴昊', '郑鑫', '马超', '林涛', '胡兵'];
const foleyArtists = ['何静', '徐丽', '朱峰', '韩雪'];

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const projects = [];
let projectCounter = 1;

for (const dir of directors) {
  const startOffset = rnd(0, 180);
  const startDate = new Date(Date.now() - startOffset * 86400000);
  const deadline = new Date(startDate.getTime() + rnd(60, 200) * 86400000);

  const project = {
    id: `proj_${projectCounter.toString().padStart(4, '0')}_${Math.random().toString(36).slice(2, 8)}`,
    name: `${dir}第${rnd(1, 3)}部_${['动作片', '剧情片', '喜剧片', '爱情片', '科幻片'][rnd(0, 4)]}_声音后期`,
    description: `${dir} 负责的影视项目声音后期制作工程，涵盖对白、环境音、音效、配乐全流程`,
    client: pick(['中影集团', '华谊兄弟', '博纳影业', '光线传媒', '万达影视', '阿里影业', '腾讯影业']),
    supervisor: pick(['王总监', '李总监', '张总监', '陈总监']),
    crewCount: rnd(8, 20),
    startDate: startDate.toISOString().slice(0, 10),
    deadline: deadline.toISOString().slice(0, 10),
    status: pick(statuses),
    createdAt: startDate.toISOString(),
    updatedAt: new Date(startDate.getTime() + rnd(1, 60) * 86400000).toISOString(),
    storagePath: path.join(ROOT, 'projects', `proj_${projectCounter.toString().padStart(4, '0')}`),
    teamMembers: [
      { role: 'supervisor', name: pick(['王总监', '李总监', '张总监']) },
      ...editors.slice(0, rnd(3, 6)).map(n => ({ role: 'editor', name: n })),
      ...mixers.slice(0, rnd(2, 4)).map(n => ({ role: 'mixer', name: n })),
      ...foleyArtists.slice(0, rnd(1, 3)).map(n => ({ role: 'foley_artist', name: n }))
    ],
    materials: [],
    feedback: [],
    activityLog: []
  };

  fs.ensureDirSync(project.storagePath);
  ['raw', 'edit', 'mix', 'deliver', '.versions'].forEach(d =>
    fs.ensureDirSync(path.join(project.storagePath, d)));

  const materialCount = rnd(200, 500);
  for (let i = 0; i < materialCount; i++) {
    const scene = `SC${rnd(1, 50).toString().padStart(3, '0')}`;
    const shot = `SH${rnd(1, 20).toString().padStart(3, '0')}`;
    const type = pick(types);
    const status = Math.random() < 0.1 ? pick(['pending', 'revision']) : pick(materialStatuses);
    const ext = pick(['.wav', '.wav', '.wav', '.aiff', '.flac', '.mp3']);
    const sampleRate = pick([44100, 48000, 48000, 96000]);
    const bitsPerSample = pick([16, 24, 24, 32]);
    const channels = pick([1, 2, 2, 2, 6, 8]);
    const durationSecs = rnd(10, 480);
    const byteRate = (sampleRate * bitsPerSample * channels) / 8;
    const fileSize = durationSecs * byteRate;
    const originalName = `${type}_${scene}_${shot}_${(i + 1).toString().padStart(4, '0')}${ext}`;
    const matPath = path.join(project.storagePath, 'raw', scene, shot);
    fs.ensureDirSync(matPath);
    const filePath = path.join(matPath, originalName);
    try {
      const fd = fs.openSync(filePath, 'w');
      fs.writeSync(fd, Buffer.alloc(Math.min(fileSize, 1024), 0));
      fs.closeSync(fd);
    } catch (e) { /* ignore */ }

    project.materials.push({
      id: `mat_${projectCounter}_${i.toString().padStart(4, '0')}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${type}_${scene}_${shot}_${(i + 1).toString().padStart(4, '0')}`,
      originalName,
      type,
      scene,
      shot,
      status,
      assignedTo: pick([...editors, ...mixers, ...foleyArtists, null]),
      description: '',
      filePath,
      metadata: {
        format: ext.slice(1).toUpperCase(),
        sampleRate,
        bitsPerSample,
        numChannels: channels,
        duration: durationSecs,
        fileSize,
        bitRate: sampleRate * bitsPerSample * channels,
        lossless: ext !== '.mp3',
        codec: ext === '.mp3' ? 'MP3' : ext === '.flac' ? 'FLAC' : 'LPCM'
      },
      tags: [type, scene, shot],
      importedFrom: `/Volumes/NAS/Media/${projectCounter}/raw/${originalName}`,
      versions: rnd(0, 8),
      feedbackIds: [],
      createdAt: new Date(startDate.getTime() + rnd(3600, 86400 * 10) * 1000).toISOString(),
      updatedAt: new Date(startDate.getTime() + rnd(86400, 86400 * 30) * 1000).toISOString()
    });
  }

  const feedbackCount = rnd(5, 40);
  for (let i = 0; i < feedbackCount; i++) {
    const mat = pick(project.materials);
    const tc = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const tcs = [];
    if (Math.random() < 0.6) {
      const t = rnd(1, Math.max(2, Math.floor((mat.metadata?.duration || 60) / 30)));
      for (let j = 0; j < t; j++) tcs.push({ timecode: tc(rnd(0, Math.floor(mat.metadata?.duration || 100))), description: pick(['此处需调整', '电平偏低', '有杂音', '音质需提升', '混音再润色', '对白替换', '时间点不对']) });
    }
    const fb = {
      id: `fb_${projectCounter}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      materialId: mat.id,
      materialName: mat.name,
      content: pick([
        '此段声音效果与画面不同步，需重新对齐',
        '对白清晰度不够，请降噪处理',
        '背景音乐音量过大，盖过了台词',
        '环境音氛围需要加强，空间感不足',
        '音效的力度和密度不够',
        '该段落有爆音，需要修复',
        '时间点00:15:30的对话需要重新配音',
        '拟音细节不够真实，请重新录制',
        '整体混音需要再平衡一下各轨道电平',
        '此段通过，效果非常好'
      ]),
      author: pick(['客户A', '客户B', '导演组', '声音总监', '剪辑指导']),
      authorEmail: pick(['review@studio.cn', 'director@film.com', 'supervisor@audio.cn', '']),
      status: Math.random() < 0.5 ? 'pending' : 'resolved',
      priority: pick(['low', 'normal', 'normal', 'normal', 'high']),
      timecodes: tcs,
      source: 'email',
      createdAt: new Date(startDate.getTime() + rnd(86400 * 3, 86400 * 60) * 1000).toISOString()
    };
    project.feedback.push(fb);
    if (!mat.feedbackIds) mat.feedbackIds = [];
    mat.feedbackIds.push(fb.id);
  }

  const logCount = rnd(20, 100);
  for (let i = 0; i < logCount; i++) {
    project.activityLog.push({
      id: `act_${Date.now().toString(36)}_${i}`,
      type: pick(['material_status_changed', 'version_submitted', 'feedback_added', 'materials_imported', 'status_changed', 'project_created']),
      description: pick([
        '导入了一批对白素材',
        '提交了混音版本',
        '新增了客户审听反馈',
        '更新了素材状态为待审核',
        '项目进入混音阶段',
        '完成了环境音的剪辑工作'
      ]),
      actor: pick([...editors, ...mixers, ...foleyArtists, 'system']),
      timestamp: new Date(startDate.getTime() + rnd(0, 86400 * 120) * 1000).toISOString()
    });
  }

  projects.push(project);
  projectCounter++;
}

const manifest = {
  version: '1.0.0',
  projects,
  lastUpdated: new Date().toISOString(),
  generated: true,
  stats: {
    totalProjects: projects.length,
    totalMaterials: projects.reduce((s, p) => s + p.materials.length, 0),
    totalFeedback: projects.reduce((s, p) => s + p.feedback.length, 0)
  }
};

const dataPath = path.join(ROOT, 'data', 'projects.json');
fs.writeFileSync(dataPath, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`生成完成：`);
console.log(`  项目数: ${manifest.stats.totalProjects}`);
console.log(`  素材数: ${manifest.stats.totalMaterials}`);
console.log(`  反馈数: ${manifest.stats.totalFeedback}`);
console.log(`  数据文件: ${dataPath}`);
