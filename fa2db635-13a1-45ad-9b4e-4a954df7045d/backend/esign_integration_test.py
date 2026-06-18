#!/usr/bin/env python3
"""
e签宝 真实开放API 集成测试脚本

使用方式：
  1. 设置环境变量注入测试凭证：
       export ESIGN_APP_ID=your_app_id
       export ESIGN_APP_SECRET=your_app_secret
       # 可选：测试环境使用 "https://smlopenapi.esign.cn"，正式环境 "https://openapi.esign.cn"
       export ESIGN_BASE_URL=https://smlopenapi.esign.cn

  2. 可选：提供测试文件路径：
       export ESIGN_TEST_PDF=/path/to/test.pdf

  3. 运行：
       python3 esign_integration_test.py

如果未设置凭证，脚本将以"占位模式"运行，打印预期请求/响应结构并跳过真实网络调用。

测试覆盖：
  T1. 获取 access_token
  T2. 个人实名认证（按要求创建个人账号，返回 accountId）
  T3. 企业认证（创建企业账号，返回 organizationId）
  T4. 通过文件上传接口（文件直传方式）
  T5. 基于文件创建签署流程
  T6. 启动签署流程
  T7. 获取签署人免登录签署链接
  T8. 查询签署流程状态
  T9. 获取已签署文件下载地址
  T10. 撤销签署流程

注意：e签宝 V3 版本接口文档参考 https://open.esign.cn/doc/detail?id=opendoc%2Fopen_api%2Fopensdk%2Fyhv563
"""

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from typing import Optional

APP_ID = os.environ.get("ESIGN_APP_ID", "").strip()
APP_SECRET = os.environ.get("ESIGN_APP_SECRET", "").strip()
BASE_URL = os.environ.get("ESIGN_BASE_URL", "https://smlopenapi.esign.cn").rstrip("/")
TEST_PDF = os.environ.get("ESIGN_TEST_PDF", "").strip()

DRY_RUN = not (APP_ID and APP_SECRET)


@dataclass
class TestCase:
    id: str
    name: str
    method: str
    path: str
    description: str
    request_sample: dict
    expected_keys: list


TEST_CASES = [
    TestCase(
        id="T1",
        name="获取 access_token",
        method="POST",
        path="/v1/oauth2/access_token",
        description="OAuth2.0 获取访问令牌，有效期 7200s，应缓存并提前 300s 刷新",
        request_sample={"appId": "APP_ID_PLACEHOLDER", "secret": "APP_SECRET_PLACEHOLDER", "grantType": "client_credentials"},
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T2",
        name="个人实名认证账号创建",
        method="POST",
        path="/v3/psn-account/create-by-third-party-user-id",
        description="根据第三方用户ID创建e签宝个人账户，用于个人签署",
        request_sample={
            "thirdPartyUserId": "wedding-user-" + str(int(time.time())),
            "name": "张三",
            "idType": "CRED_PSN_CH_IDCARD",
            "idNumber": "110101199001011234",
            "mobile": "13800138000",
        },
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T3",
        name="企业账号创建",
        method="POST",
        path="/v3/organizations/create-by-third-party-user-id",
        description="根据第三方用户ID创建企业账号，用于企业方签署",
        request_sample={
            "thirdPartyUserId": "wedding-org-" + str(int(time.time())),
            "name": "上海锦时婚庆服务有限公司",
            "idType": "CRED_ORG_USCC",
            "idNumber": "91310000MA1FL2XX54",
            "creator": "creator-account-id",
            "creatorType": "PSN",
        },
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T4",
        name="合同文件上传",
        method="POST",
        path="/v2/files/get-upload-url",
        description="两步上传：先获取上传地址与 fileKey，再 PUT 文件，MD5 校验完整性",
        request_sample={
            "contentMd5": "base64(md5(content))",
            "contentType": "application/pdf",
            "fileName": "contract-1001.pdf",
            "fileSize": 102400,
            "convert2Pdf": False,
        },
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T5",
        name="基于文件创建签署流程",
        method="POST",
        path="/v3/sign-flow/create-by-file",
        description="基于已上传文件创建签署流程，指定签署人、签署位置",
        request_sample={
            "docs": [{"fileId": "FILEKEY_FROM_T4", "fileName": "contract.pdf"}],
            "signFlowConfig": {
                "signFlowTitle": "婚礼服务合同签署",
                "signFlowRemark": "合同编号 HT-2026-001",
                "chargeMode": "PLATFORM",
                "notifyUrl": "https://your-api.example.com/api/esign/callback",
            },
            "signers": [{
                "signerType": 1,
                "psnSigner": {"psnAccount": "13800138000"},
                "signFields": [{
                    "fileId": "FILEKEY_FROM_T4",
                    "signerType": "PERSONAL_SEAL",
                    "normalSignFieldConfig": {
                        "autoSign": False,
                        "signFieldStyle": 1,
                        "signFieldPosition": {
                            "positionPage": "1",
                            "positionX": 400.0,
                            "positionY": 150.0,
                            "width": 150.0,
                        },
                    },
                }],
            }],
        },
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T6",
        name="启动签署流程",
        method="POST",
        path="/v3/sign-flow/{signFlowId}/start",
        description="创建后必须显式 start，才会通知签署人",
        request_sample={},
        expected_keys=["code"],
    ),
    TestCase(
        id="T7",
        name="获取签署链接",
        method="POST",
        path="/v3/sign-flow/{signFlowId}/sign-urls",
        description="生成免登录签署 H5 链接，有限期默认 30 分钟",
        request_sample={
            "operator": {"operatorId": "account-id-from-T2", "operatorType": "PSN"},
            "urlType": "1",
        },
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T8",
        name="查询签署流程状态",
        method="GET",
        path="/v3/sign-flow/{signFlowId}",
        description="signFlowStatus: 0草稿 1签署中 2已完成 3已作废 4已过期 5已拒签",
        request_sample={},
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T9",
        name="获取已签署文件下载地址",
        method="GET",
        path="/v3/sign-flow/{signFlowId}/download-url",
        description="签署完成后下载回传的 PDF，有效期短，建议立即中转保存",
        request_sample={},
        expected_keys=["code", "data"],
    ),
    TestCase(
        id="T10",
        name="撤销签署流程",
        method="POST",
        path="/v3/sign-flow/{signFlowId}/revoke",
        description="签署中可撤销，撤销后状态变为 3(作废)",
        request_sample={"revokeReason": "测试撤销"},
        expected_keys=["code"],
    ),
]


def compute_md5_b64(data: bytes) -> str:
    import base64
    return base64.b64encode(hashlib.md5(data).digest()).decode("ascii")


def http_call(method: str, url: str, token: Optional[str], body: Optional[dict]) -> tuple[int, str]:
    data = None
    headers = {"Content-Type": "application/json;charset=UTF-8"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def main() -> int:
    print("=" * 72)
    print("  e签宝开放平台真实 API 集成测试")
    print("=" * 72)
    if DRY_RUN:
        print("[DRY-RUN] 未检测到 ESIGN_APP_ID / ESIGN_APP_SECRET 环境变量，")
        print("         跳过真实网络调用，仅展示各接口请求/响应结构。")
        print("         设置环境变量后可再次运行进行真实接口验证。")
    else:
        print(f"[REAL-RUN] 环境: {BASE_URL}  AppID: {APP_ID[:6]}***")
    print()

    passed = 0
    failed = 0
    skipped = 0
    token = None
    created_resources = {"psn": None, "org": None, "fileKey": None, "flowId": None}

    # 加载测试 PDF
    pdf_bytes = None
    if TEST_PDF and os.path.exists(TEST_PDF):
        with open(TEST_PDF, "rb") as f:
            pdf_bytes = f.read()
        print(f"[FILE] 已加载测试 PDF: {TEST_PDF}  ({len(pdf_bytes)} bytes)")
    elif not DRY_RUN:
        # 生成最小 PDF
        pdf_bytes = (
            b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
            b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
            b"xref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF\n"
        )

    for tc in TEST_CASES:
        path = tc.path
        body = dict(tc.request_sample) if tc.request_sample else None

        # ========= 动态变量填充 =========
        if tc.id == "T1":
            body["appId"] = APP_ID or "YOUR-APP-ID"
            body["secret"] = APP_SECRET or "YOUR-APP-SECRET"
        if tc.id in ("T6", "T7", "T8", "T9", "T10"):
            flow_id = created_resources["flowId"] or "SIGN_FLOW_ID_FROM_T5"
            path = path.format(signFlowId=flow_id)
        if tc.id == "T5" and created_resources["fileKey"]:
            for d in body["docs"]:
                d["fileId"] = created_resources["fileKey"]
            body["signers"][0]["signFields"][0]["fileId"] = created_resources["fileKey"]
        if tc.id == "T4" and pdf_bytes:
            body["contentMd5"] = compute_md5_b64(pdf_bytes)
            body["fileSize"] = len(pdf_bytes)
        # =================================

        url = BASE_URL + path
        status = 0
        resp_body = ""
        ok = False
        err_msg = None

        print(f"[{tc.id}] {tc.name}")
        print(f"      {tc.method} {path}")
        print(f"      {tc.description}")

        if DRY_RUN:
            skipped += 1
            print(f"      REQ: {json.dumps(body, ensure_ascii=False)[:160]}")
            print(f"      EXPECTED KEYS: {tc.expected_keys}")
            print(f"      → SKIP (dry-run)\n")
            continue

        auth_token = None if tc.id == "T1" else token
        if tc.id == "T4":
            # T4: 获取上传地址；如果成功，接着 PUT 文件
            status, resp_body = http_call(tc.method, url, auth_token, body)
            try:
                obj = json.loads(resp_body)
                if obj.get("code") == 0:
                    upload_url = obj["data"]["uploadUrl"]
                    file_key = obj["data"]["fileKey"]
                    created_resources["fileKey"] = file_key
                    # PUT
                    put_req = urllib.request.Request(
                        upload_url,
                        data=pdf_bytes,
                        headers={"Content-Type": body["contentType"], "Content-MD5": body["contentMd5"]},
                        method="PUT",
                    )
                    with urllib.request.urlopen(put_req, timeout=60) as put_resp:
                        _ = put_resp.read()
                    resp_body = json.dumps({"code": 0, "data": {"fileKey": file_key, "uploaded": True}})
            except Exception as pe:
                err_msg = f"上传失败: {pe}"
        else:
            status, resp_body = http_call(tc.method, url, auth_token, body)

        obj = {}
        try:
            obj = json.loads(resp_body) if resp_body else {}
        except Exception:
            err_msg = err_msg or f"响应非JSON: {resp_body[:100]}"

        # 提取业务数据
        code = obj.get("code", -1) if isinstance(obj, dict) else -1
        ok = (status in (200, 201, 204)) and (code == 0) and all(
            k in obj for k in tc.expected_keys
        )

        # ========= 后处理 =========
        if tc.id == "T1" and ok:
            token = obj["data"].get("access_token")
            print(f"      TOKEN: {token[:12]}... expires={obj['data'].get('expires_in')}s")
        if tc.id == "T2" and ok:
            created_resources["psn"] = obj["data"].get("accountId")
            print(f"      accountId: {created_resources['psn']}")
        if tc.id == "T3" and ok:
            created_resources["org"] = obj["data"].get("organizationId")
            print(f"      organizationId: {created_resources['org']}")
        if tc.id == "T5" and ok:
            created_resources["flowId"] = obj["data"].get("signFlowId")
            print(f"      signFlowId: {created_resources['flowId']}")
        if tc.id == "T7" and ok:
            urls = obj["data"].get("signUrl") or obj["data"].get("links") or []
            if isinstance(urls, list) and urls:
                print(f"      签署URL: {urls[0].get('url', urls[0])[:80]}...")
            elif isinstance(urls, str):
                print(f"      签署URL: {urls[:80]}...")
        # ==========================

        if ok:
            passed += 1
            print(f"      HTTP {status} code={code}")
            print(f"      ✅ PASS\n")
        else:
            failed += 1
            print(f"      HTTP {status} body={resp_body[:200]}")
            if err_msg:
                print(f"      ERR: {err_msg}")
            print(f"      ❌ FAIL (code={code}, expected keys {tc.expected_keys})\n")

    print("=" * 72)
    print(f"  结果:  PASS={passed}  FAIL={failed}  SKIP={skipped}")
    if created_resources and not DRY_RUN:
        print(f"  创建的资源: {json.dumps(created_resources, ensure_ascii=False)}")
    print("=" * 72)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
