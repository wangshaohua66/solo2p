#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""农产品价格监测预警系统 - 快捷启动脚本"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from price_monitor.cli import main

if __name__ == "__main__":
    main()
