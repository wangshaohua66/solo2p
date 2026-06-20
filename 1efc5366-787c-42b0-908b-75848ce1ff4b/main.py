#!/usr/bin/env python3
"""
海关缉私情报分析系统 (CRISK) - 主入口脚本

直接运行: python main.py [command] [options]
或安装后: crisk [command] [options]
"""

from crisk.cli import entry_point

if __name__ == "__main__":
    entry_point()
