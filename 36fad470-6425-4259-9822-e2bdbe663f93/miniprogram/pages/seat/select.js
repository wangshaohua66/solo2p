const app = getApp()

Page({
  data: {
    performanceId: '',
    sections: [],
    selectedSeats: [],
    totalPrice: 0,
    loading: false
  },

  onLoad(options) {
    if (options.performanceId) {
      this.setData({ performanceId: options.performanceId })
      this.loadSeats(options.performanceId)
    }
  },

  processSeatsWithSelection(sections, selectedSeats) {
    const selectedKeys = new Set(selectedSeats.map((s) => s.key))
    return sections.map((section) => ({
      ...section,
      seats: section.seats.map((seat) => ({
        ...seat,
        isSelected: selectedKeys.has(`${section.id}-${seat.row}-${seat.col}`)
      }))
    }))
  },

  loadSeats(performanceId) {
    this.setData({ loading: true })
    app.request({
      url: `/tickets/seats`,
      method: 'GET',
      data: { performanceId }
    }).then((res) => {
      const sections = res.data?.sections || res.data?.data || []
      const processedSections = this.processSeatsWithSelection(sections, this.data.selectedSeats)
      this.setData({ sections: processedSections, loading: false })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  onSeatTap(e) {
    const { sectionId, row, col, status, price } = e.currentTarget.dataset
    if (status !== 'available') {
      wx.showToast({ title: '该座位不可选', icon: 'none' })
      return
    }

    const key = `${sectionId}-${row}-${col}`
    const selected = [...this.data.selectedSeats]
    const idx = selected.findIndex((s) => s.key === key)

    if (idx >= 0) {
      selected.splice(idx, 1)
    } else {
      if (selected.length >= 6) {
        wx.showToast({ title: '最多选择6个座位', icon: 'none' })
        return
      }
      selected.push({ key, sectionId, row, col, price: Number(price) })
    }

    const totalPrice = selected.reduce((sum, s) => sum + s.price, 0)
    const processedSections = this.processSeatsWithSelection(this.data.sections, selected)
    this.setData({ selectedSeats: selected, sections: processedSections, totalPrice })
  },

  onConfirmTap() {
    const seats = this.data.selectedSeats
    if (seats.length === 0) {
      wx.showToast({ title: '请先选择座位', icon: 'none' })
      return
    }

    const totalAmount = seats.reduce((sum, s) => sum + s.price, 0)

    app.request({
      url: '/orders',
      method: 'POST',
      data: {
        performanceId: this.data.performanceId,
        seats: seats.map((s) => ({
          sectionId: s.sectionId,
          row: s.row,
          column: s.col
        }))
      }
    }).then((res) => {
      const orderId = res.data?.data?.id || res.data?.id
      if (orderId) {
        wx.showToast({ title: `下单成功 ¥${totalAmount}`, icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/order/detail?id=${orderId}` })
        }, 1500)
      }
    }).catch((err) => {
      wx.showToast({ title: '下单失败', icon: 'none' })
    })
  }
})
